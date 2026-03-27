import { createClient } from "@/lib/supabase/server"

export type MonthlyRow = { month: string; revenue: number; expenses: number; profit: number }

export type FinancialStats = {
  // Current month
  currentRevenue: number     // paid issued invoices this month
  currentExpenses: number    // paid received invoices this month
  currentProfit: number      // revenue - expenses
  // VAT position
  vatCollected: number       // sum vat_amount from paid issued invoices this month
  vatDeductible: number      // sum vat_amount from paid received invoices this month
  vatPosition: number        // vatCollected - vatDeductible (positive = owe tax authority)
  // Tax estimate (Slovak corporate tax: 15% up to €49,790, 21% above)
  taxEstimate: number
  // Last 6 months trend (for table/chart)
  monthlyTrend: MonthlyRow[]
}

export async function getFinancialStats(orgId: string): Promise<FinancialStats> {
  const supabase = await createClient()

  // Last 6 months range
  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5)
  sixMonthsAgo.setDate(1)
  sixMonthsAgo.setHours(0, 0, 0, 0)

  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  // Fetch paid invoices + organization VAT status
  const [{ data: invoices }, { data: org }] = await Promise.all([
    supabase
      .from("invoices")
      .select("invoice_type, subtotal, total, vat_amount, paid_at")
      .eq("organization_id", orgId)
      .eq("status", "paid")
      .gte("paid_at", sixMonthsAgo.toISOString())
      .is("deleted_at", null),
    supabase
      .from("organizations")
      .select("ic_dph")
      .eq("id", orgId)
      .single(),
  ])

  const isVatPayer = !!org?.ic_dph

  const rows = (invoices ?? []) as Array<{
    invoice_type: string
    subtotal: number | null
    total: number | null
    vat_amount: number | null
    paid_at: string | null
  }>

  // Group by month
  const monthMap = new Map<string, { revenue: number; expenses: number }>()

  for (const row of rows) {
    if (!row.paid_at) continue
    const d = new Date(row.paid_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    if (!monthMap.has(key)) monthMap.set(key, { revenue: 0, expenses: 0 })
    const m = monthMap.get(key)!
    const amount = Number(row.total) || 0
    if (row.invoice_type === "issued") m.revenue += amount
    else m.expenses += amount
  }

  // Build last 6 months array (including months with 0)
  const monthlyTrend: MonthlyRow[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`
    const label = d.toLocaleDateString("sk-SK", { month: "short", year: "2-digit" })
    const m = monthMap.get(key) ?? { revenue: 0, expenses: 0 }
    monthlyTrend.push({ month: label, revenue: m.revenue, expenses: m.expenses, profit: m.revenue - m.expenses })
  }

  // Current month values
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`
  const cm = monthMap.get(currentMonthKey) ?? { revenue: 0, expenses: 0 }
  const currentRevenue = cm.revenue
  const currentExpenses = cm.expenses
  const currentProfit = currentRevenue - currentExpenses

  // VAT (current month only) — use UTC-consistent comparison
  const startOfMonthISO = startOfMonth.toISOString()
  const currentMonthRows = rows.filter(r => {
    if (!r.paid_at) return false
    return r.paid_at >= startOfMonthISO
  })
  const vatCollected = currentMonthRows
    .filter(r => r.invoice_type === "issued")
    .reduce((s, r) => s + (Number(r.vat_amount) || 0), 0)
  const vatDeductible = currentMonthRows
    .filter(r => r.invoice_type === "received")
    .reduce((s, r) => s + (Number(r.vat_amount) || 0), 0)

  // Tax estimate uses net amounts (without VAT) for VAT payers
  const taxableProfit = isVatPayer
    ? currentProfit - (vatCollected - vatDeductible)
    : currentProfit

  return {
    currentRevenue, currentExpenses, currentProfit,
    vatCollected, vatDeductible, vatPosition: vatCollected - vatDeductible,
    taxEstimate: Math.max(
      0,
      taxableProfit <= 49790
        ? taxableProfit * 0.15
        : 49790 * 0.15 + (taxableProfit - 49790) * 0.21
    ),
    monthlyTrend,
  }
}
