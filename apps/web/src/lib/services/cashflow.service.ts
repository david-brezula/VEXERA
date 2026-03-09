/**
 * Cash flow forecasting service.
 *
 * - detectRecurringPatterns  — analyse bank_transactions for repeating items
 * - forecast                 — project daily cash position for N days
 * - getCashFlowSummary       — summary widget data (30/60/90d outlook)
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  CashFlowForecastPoint,
  CashFlowItem,
  CashFlowDirection,
  RecurringPattern,
} from "@vexera/types"

// ─── helpers ────────────────────────────────────────────────────────────────

/** ISO date string YYYY-MM-DD */
function toDateKey(d: Date): string {
  return d.toISOString().split("T")[0]
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

function stddev(values: number[]): number {
  if (values.length < 2) return 0
  const mean = values.reduce((s, v) => s + v, 0) / values.length
  const sumSq = values.reduce((s, v) => s + (v - mean) ** 2, 0)
  return Math.sqrt(sumSq / (values.length - 1))
}

// ─── detectRecurringPatterns ────────────────────────────────────────────────

export async function detectRecurringPatterns(
  supabase: SupabaseClient,
  orgId: string,
): Promise<RecurringPattern[]> {
  // Fetch all bank transactions for the org
  const { data: txns, error } = await supabase
    .from("bank_transactions")
    .select(
      "id, counterpart_name, counterpart_iban, amount, currency, transaction_date",
    )
    .eq("organization_id", orgId)
    .order("transaction_date", { ascending: true })

  if (error) throw new Error(`Failed to fetch transactions: ${error.message}`)

  const rows = (txns ?? []) as Array<{
    id: string
    counterpart_name: string | null
    counterpart_iban: string | null
    amount: number
    currency: string
    transaction_date: string
  }>

  // Group by counterpart identifier
  const groups = new Map<
    string,
    { name: string | null; iban: string | null; entries: typeof rows }
  >()

  for (const row of rows) {
    const key = row.counterpart_name ?? row.counterpart_iban ?? "__unknown__"
    if (key === "__unknown__") continue
    if (!groups.has(key)) {
      groups.set(key, {
        name: row.counterpart_name,
        iban: row.counterpart_iban,
        entries: [],
      })
    }
    groups.get(key)!.entries.push(row)
  }

  const patterns: RecurringPattern[] = []

  for (const [, group] of groups) {
    if (group.entries.length < 3) continue

    const amounts = group.entries.map((e) => e.amount)
    const avgAmount =
      amounts.reduce((s, v) => s + v, 0) / amounts.length
    const amountStddev = stddev(amounts)

    // Calculate average frequency in days
    const dates = group.entries.map(
      (e) => new Date(e.transaction_date).getTime(),
    )
    const gaps: number[] = []
    for (let i = 1; i < dates.length; i++) {
      gaps.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24))
    }
    const frequencyDays = Math.round(
      gaps.reduce((s, v) => s + v, 0) / gaps.length,
    )

    const lastEntry = group.entries[group.entries.length - 1]
    const lastSeen = lastEntry.transaction_date
    const nextExpected = toDateKey(
      addDays(new Date(lastSeen), frequencyDays),
    )

    const direction: CashFlowDirection = avgAmount >= 0 ? "inflow" : "outflow"

    // Upsert into recurring_patterns table
    const payload = {
      organization_id: orgId,
      counterpart_name: group.name,
      counterpart_iban: group.iban,
      typical_amount: Math.round(avgAmount * 100) / 100,
      amount_stddev: Math.round(amountStddev * 100) / 100,
      currency: lastEntry.currency ?? "EUR",
      direction,
      frequency_days: frequencyDays,
      last_seen_at: lastSeen,
      next_expected_at: nextExpected,
      occurrence_count: group.entries.length,
      is_active: true,
      updated_at: new Date().toISOString(),
    }

    const { data: upserted, error: upsertErr } = await supabase
      .from("recurring_patterns")
      .upsert(payload, {
        onConflict: "organization_id,counterpart_name,counterpart_iban",
      })
      .select()
      .single()

    if (upsertErr) {
      // If table doesn't exist or upsert fails, still return the computed pattern
      console.warn("recurring_patterns upsert warning:", upsertErr.message)
      patterns.push({
        id: "",
        created_at: new Date().toISOString(),
        category: null,
        ...payload,
      } as RecurringPattern)
    } else {
      patterns.push(upserted as unknown as RecurringPattern)
    }
  }

  return patterns
}

// ─── forecast ───────────────────────────────────────────────────────────────

export async function forecast(
  supabase: SupabaseClient,
  orgId: string,
  days: number = 90,
): Promise<CashFlowForecastPoint[]> {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // 1. Current bank balance (sum of all transactions)
  const { data: balanceRows } = await supabase
    .from("bank_transactions")
    .select("amount")
    .eq("organization_id", orgId)

  let currentBalance = (balanceRows ?? []).reduce(
    (sum, r) => sum + (Number((r as { amount: number }).amount) || 0),
    0,
  )

  // 2. Unpaid issued invoices → expected inflows
  const { data: issuedInvoices } = await supabase
    .from("invoices")
    .select("id, total, due_date, client_name")
    .eq("organization_id", orgId)
    .eq("invoice_type", "issued")
    .in("status", ["sent", "overdue"])
    .is("deleted_at", null)

  type InvoiceRow = {
    id: string
    total: number | null
    due_date: string | null
    client_name: string | null
  }
  const inflows = (issuedInvoices ?? []) as InvoiceRow[]

  // 3. Unpaid received invoices → expected outflows
  const { data: receivedInvoices } = await supabase
    .from("invoices")
    .select("id, total, due_date, client_name")
    .eq("organization_id", orgId)
    .eq("invoice_type", "received")
    .in("status", ["sent", "overdue", "draft"])
    .is("deleted_at", null)

  const outflows = (receivedInvoices ?? []) as InvoiceRow[]

  // 4. Recurring patterns
  const { data: patternsData } = await supabase
    .from("recurring_patterns")
    .select("*")
    .eq("organization_id", orgId)
    .eq("is_active", true)

  const patterns = (patternsData ?? []) as RecurringPattern[]

  // 5. Build day-by-day forecast
  const endDate = addDays(today, days)

  // Pre-index invoices by due date
  const inflowByDate = new Map<string, CashFlowItem[]>()
  for (const inv of inflows) {
    const dueDate = inv.due_date ?? toDateKey(today)
    const key = dueDate < toDateKey(today) ? toDateKey(today) : dueDate
    if (!inflowByDate.has(key)) inflowByDate.set(key, [])
    inflowByDate.get(key)!.push({
      description: `Invoice from ${inv.client_name ?? "unknown"}`,
      amount: Number(inv.total) || 0,
      direction: "inflow",
      source: "invoice",
      confidence: 0.8,
    })
  }

  const outflowByDate = new Map<string, CashFlowItem[]>()
  for (const inv of outflows) {
    const dueDate = inv.due_date ?? toDateKey(today)
    const key = dueDate < toDateKey(today) ? toDateKey(today) : dueDate
    if (!outflowByDate.has(key)) outflowByDate.set(key, [])
    outflowByDate.get(key)!.push({
      description: `Payment to ${inv.client_name ?? "unknown"}`,
      amount: Math.abs(Number(inv.total) || 0),
      direction: "outflow",
      source: "invoice",
      confidence: 0.8,
    })
  }

  // Project recurring patterns into future dates
  const recurringByDate = new Map<string, CashFlowItem[]>()
  for (const pat of patterns) {
    if (!pat.next_expected_at || pat.frequency_days <= 0) continue
    let nextDate = new Date(pat.next_expected_at)
    while (nextDate <= endDate) {
      if (nextDate >= today) {
        const key = toDateKey(nextDate)
        if (!recurringByDate.has(key)) recurringByDate.set(key, [])
        recurringByDate.get(key)!.push({
          description: `Recurring: ${pat.counterpart_name ?? pat.counterpart_iban ?? "unknown"}`,
          amount: Math.abs(pat.typical_amount),
          direction: pat.direction,
          source: "recurring",
          confidence: Math.max(0.3, 1 - pat.amount_stddev / Math.abs(pat.typical_amount || 1)),
        })
      }
      nextDate = addDays(nextDate, pat.frequency_days)
    }
  }

  // 6. Assemble daily forecast points
  const forecastPoints: CashFlowForecastPoint[] = []
  let runningBalance = currentBalance

  for (let i = 0; i <= days; i++) {
    const d = addDays(today, i)
    const key = toDateKey(d)

    const dayItems: CashFlowItem[] = [
      ...(inflowByDate.get(key) ?? []),
      ...(outflowByDate.get(key) ?? []),
      ...(recurringByDate.get(key) ?? []),
    ]

    const dayInflows = dayItems
      .filter((it) => it.direction === "inflow")
      .reduce((s, it) => s + it.amount, 0)

    const dayOutflows = dayItems
      .filter((it) => it.direction === "outflow")
      .reduce((s, it) => s + it.amount, 0)

    runningBalance = runningBalance + dayInflows - dayOutflows

    forecastPoints.push({
      date: key,
      projected_balance: Math.round(runningBalance * 100) / 100,
      inflows: Math.round(dayInflows * 100) / 100,
      outflows: Math.round(dayOutflows * 100) / 100,
      items: dayItems,
    })
  }

  return forecastPoints
}

// ─── getCashFlowSummary ─────────────────────────────────────────────────────

export interface CashFlowSummary {
  current_balance: number
  forecast_30d: number
  forecast_60d: number
  forecast_90d: number
  risk_date: string | null
}

export async function getCashFlowSummary(
  supabase: SupabaseClient,
  orgId: string,
): Promise<CashFlowSummary> {
  const points = await forecast(supabase, orgId, 90)

  const current_balance = points.length > 0 ? points[0].projected_balance : 0
  const forecast_30d =
    points.length > 30 ? points[30].projected_balance : points[points.length - 1]?.projected_balance ?? 0
  const forecast_60d =
    points.length > 60 ? points[60].projected_balance : points[points.length - 1]?.projected_balance ?? 0
  const forecast_90d =
    points.length > 90 ? points[90].projected_balance : points[points.length - 1]?.projected_balance ?? 0

  // First date where balance goes negative
  const riskPoint = points.find((p) => p.projected_balance < 0)
  const risk_date = riskPoint?.date ?? null

  return {
    current_balance: Math.round(current_balance * 100) / 100,
    forecast_30d: Math.round(forecast_30d * 100) / 100,
    forecast_60d: Math.round(forecast_60d * 100) / 100,
    forecast_90d: Math.round(forecast_90d * 100) / 100,
    risk_date,
  }
}
