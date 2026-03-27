/**
 * Category Report Service
 *
 * Generates expense/revenue breakdowns by category with drill-down
 * capability to individual documents.
 *
 * Usage:
 *   const report = await generateCategoryReport(supabase, orgId, {
 *     from: "2026-01-01", to: "2026-03-31"
 *   })
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { ReportPeriod, CategoryBreakdown, CategoryBreakdownRow } from "./report.types"

interface DocRow {
  id: string
  category: string | null
  total_amount: number | null
  document_type: string | null
  currency: string | null
}

export async function generateCategoryReport(
  supabase: SupabaseClient,
  organizationId: string,
  period: ReportPeriod,
  currency: string = "EUR"
): Promise<CategoryBreakdown> {
  // Fetch documents within the period
  const { data: docsData } = await supabase
    .from("documents")
    .select("id, category, total_amount, document_type, currency")
    .eq("organization_id", organizationId)
    .gte("issue_date", period.from)
    .lte("issue_date", period.to)
    .is("deleted_at", null)

  const docs = (docsData ?? []) as unknown as DocRow[]

  // Separate expenses and revenues
  const expenseTypes = new Set(["invoice_received", "receipt", "expense"])
  const revenueTypes = new Set(["invoice_issued", "revenue"])

  const expenseMap = new Map<string, { amount: number; count: number; ids: string[] }>()
  const revenueMap = new Map<string, { amount: number; count: number; ids: string[] }>()

  let totalExpenses = 0
  let totalRevenue = 0

  for (const doc of docs) {
    if (!doc.total_amount || doc.total_amount <= 0) continue

    const category = doc.category ?? "Bez kategórie"
    const isExpense = expenseTypes.has(doc.document_type ?? "")
    const isRevenue = revenueTypes.has(doc.document_type ?? "")

    // Default: classify by document_type, or treat as expense
    const targetMap = isRevenue ? revenueMap : expenseMap

    const entry = targetMap.get(category) ?? { amount: 0, count: 0, ids: [] }
    entry.amount += doc.total_amount
    entry.count++
    entry.ids.push(doc.id)
    targetMap.set(category, entry)

    if (isRevenue) {
      totalRevenue += doc.total_amount
    } else {
      totalExpenses += doc.total_amount
    }
  }

  // Also include issued invoices from the invoices table
  const { data: invoicesData } = await supabase
    .from("invoices")
    .select("id, total_amount, currency")
    .eq("organization_id", organizationId)
    .eq("invoice_type", "issued")
    .gte("issue_date", period.from)
    .lte("issue_date", period.to)

  for (const inv of (invoicesData ?? []) as unknown as { id: string; total_amount: number | null }[]) {
    if (!inv.total_amount || inv.total_amount <= 0) continue
    const category = "Vydané faktúry"
    const entry = revenueMap.get(category) ?? { amount: 0, count: 0, ids: [] }
    entry.amount += inv.total_amount
    entry.count++
    entry.ids.push(inv.id)
    revenueMap.set(category, entry)
    totalRevenue += inv.total_amount
  }

  const buildRows = (
    map: Map<string, { amount: number; count: number; ids: string[] }>,
    total: number
  ): CategoryBreakdownRow[] =>
    Array.from(map.entries())
      .map(([category, data]) => ({
        category,
        totalAmount: Number(data.amount.toFixed(2)),
        transactionCount: data.count,
        percentage: total > 0 ? Number(((data.amount / total) * 100).toFixed(1)) : 0,
        documentIds: data.ids,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount)

  return {
    period,
    currency,
    totalExpenses: Number(totalExpenses.toFixed(2)),
    totalRevenue: Number(totalRevenue.toFixed(2)),
    expensesByCategory: buildRows(expenseMap, totalExpenses),
    revenueByCategory: buildRows(revenueMap, totalRevenue),
  }
}
