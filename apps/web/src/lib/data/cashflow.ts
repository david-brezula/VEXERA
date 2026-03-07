import { createClient } from "@/lib/supabase/server"

export type CashFlowSummary = {
  current_balance: number
  forecast_30d: number
  forecast_60d: number
  forecast_90d: number
  risk_date: string | null    // first date balance goes negative, or null
}

export type CashFlowPoint = {
  date: string
  balance: number
  inflows: number
  outflows: number
}

export type RecurringPatternRow = {
  id: string
  counterpart_name: string | null
  typical_amount: number
  currency: string
  direction: "inflow" | "outflow"
  frequency_days: number
  next_expected_at: string | null
  category: string | null
}

export async function getCashFlowData(orgId: string): Promise<{
  summary: CashFlowSummary
  forecast: CashFlowPoint[]
  patterns: RecurringPatternRow[]
}> {
  const supabase = await createClient()

  // Get current balance from bank transactions
  const { data: txData } = await supabase
    .from("bank_transactions")
    .select("amount")
    .eq("organization_id", orgId)

  const currentBalance = (txData ?? []).reduce(
    (sum, row) => sum + (Number((row as { amount: number }).amount) || 0),
    0
  )

  // Get unpaid issued invoices (expected inflows)
  const { data: receivables } = await supabase
    .from("invoices")
    .select("total, due_date")
    .eq("organization_id", orgId)
    .eq("invoice_type", "issued")
    .in("status", ["sent", "overdue"])
    .is("deleted_at", null)
    .order("due_date", { ascending: true })

  // Get unpaid received invoices (expected outflows)
  const { data: payables } = await supabase
    .from("invoices")
    .select("total, due_date")
    .eq("organization_id", orgId)
    .eq("invoice_type", "received")
    .in("status", ["sent", "overdue"])
    .is("deleted_at", null)
    .order("due_date", { ascending: true })

  // Get recurring patterns
  const { data: patternData } = await supabase
    .from("recurring_patterns")
    .select("id, counterpart_name, typical_amount, currency, direction, frequency_days, next_expected_at, category")
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .order("next_expected_at", { ascending: true })

  const patterns = (patternData ?? []) as unknown as RecurringPatternRow[]

  // Build 90-day forecast
  const today = new Date()
  const forecast: CashFlowPoint[] = []
  let runningBalance = currentBalance
  let riskDate: string | null = null

  type InvoiceRow = { total: number | null; due_date: string | null }
  const receivableRows = (receivables ?? []) as unknown as InvoiceRow[]
  const payableRows = (payables ?? []) as unknown as InvoiceRow[]

  for (let d = 0; d < 90; d++) {
    const date = new Date(today)
    date.setDate(date.getDate() + d)
    const dateStr = date.toISOString().split("T")[0]!

    // Inflows from due invoices
    const dayInflows = receivableRows
      .filter((inv) => inv.due_date === dateStr)
      .reduce((s, inv) => s + (Number(inv.total) || 0), 0)

    // Outflows from payable invoices
    const dayOutflows = payableRows
      .filter((inv) => inv.due_date === dateStr)
      .reduce((s, inv) => s + (Number(inv.total) || 0), 0)

    // Recurring patterns due on this day
    let recurringIn = 0
    let recurringOut = 0
    for (const p of patterns) {
      if (p.next_expected_at) {
        const nextDate = new Date(p.next_expected_at)
        // Check if pattern fires on this date (or subsequent occurrences)
        const diffDays = Math.round((date.getTime() - nextDate.getTime()) / 86400000)
        if (diffDays >= 0 && diffDays % p.frequency_days === 0) {
          if (p.direction === "inflow") recurringIn += p.typical_amount
          else recurringOut += p.typical_amount
        }
      }
    }

    const totalInflows = dayInflows + recurringIn
    const totalOutflows = dayOutflows + recurringOut
    runningBalance = runningBalance + totalInflows - totalOutflows

    if (runningBalance < 0 && !riskDate) {
      riskDate = dateStr
    }

    forecast.push({
      date: dateStr,
      balance: Math.round(runningBalance * 100) / 100,
      inflows: Math.round(totalInflows * 100) / 100,
      outflows: Math.round(totalOutflows * 100) / 100,
    })
  }

  const summary: CashFlowSummary = {
    current_balance: Math.round(currentBalance * 100) / 100,
    forecast_30d: forecast[29]?.balance ?? currentBalance,
    forecast_60d: forecast[59]?.balance ?? currentBalance,
    forecast_90d: forecast[89]?.balance ?? currentBalance,
    risk_date: riskDate,
  }

  return { summary, forecast, patterns }
}
