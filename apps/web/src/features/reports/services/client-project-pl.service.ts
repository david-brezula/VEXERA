/**
 * Client/Project P&L Report Service
 *
 * Generates Profit & Loss reports segmented by client or project tags.
 * Joins documents/invoices through entity_tags to compute revenue - expense per tag.
 *
 * Usage:
 *   const report = await generateTagPL(supabase, orgId, tagId, { from, to })
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { ReportPeriod, PLReport, PLRow } from "./report.types"

interface DocRow {
  id: string
  category: string | null
  total_amount: number | null
  document_type: string | null
  currency: string | null
}

export async function generateTagPL(
  supabase: SupabaseClient,
  organizationId: string,
  tagId: string,
  period: ReportPeriod,
  currency: string = "EUR"
): Promise<PLReport | null> {
  // Get tag info
  const { data: tagData } = await supabase
    .from("tags")
    .select("id, name, tag_type")
    .eq("id", tagId)
    .single()

  if (!tagData) return null

  const tag = tagData as unknown as { id: string; name: string; tag_type: string }

  // Get all entity IDs tagged with this tag
  const { data: entityTagsData } = await supabase
    .from("entity_tags")
    .select("entity_type, entity_id")
    .eq("tag_id", tagId)

  const entityTags = (entityTagsData ?? []) as unknown as { entity_type: string; entity_id: string }[]

  const documentIds = entityTags.filter(e => e.entity_type === "document").map(e => e.entity_id)
  const invoiceIds = entityTags.filter(e => e.entity_type === "invoice").map(e => e.entity_id)

  const expenseTypes = new Set(["invoice_received", "receipt", "expense"])

  // Fetch tagged documents within period
  let docs: DocRow[] = []
  if (documentIds.length > 0) {
    const { data: docsData } = await supabase
      .from("documents")
      .select("id, category, total_amount, document_type, currency")
      .eq("organization_id", organizationId)
      .in("id", documentIds)
      .gte("issue_date", period.from)
      .lte("issue_date", period.to)
      .is("deleted_at", null)

    docs = (docsData ?? []) as unknown as DocRow[]
  }

  // Fetch tagged invoices within period
  let invoiceTotal = 0
  let invoiceCount = 0
  if (invoiceIds.length > 0) {
    const { data: invoicesData } = await supabase
      .from("invoices")
      .select("id, total_amount")
      .eq("organization_id", organizationId)
      .in("id", invoiceIds)
      .gte("issue_date", period.from)
      .lte("issue_date", period.to)

    for (const inv of (invoicesData ?? []) as unknown as { total_amount: number | null }[]) {
      if (inv.total_amount && inv.total_amount > 0) {
        invoiceTotal += inv.total_amount
        invoiceCount++
      }
    }
  }

  // Build expense and revenue rows
  const expenseMap = new Map<string, { amount: number; count: number }>()
  const revenueMap = new Map<string, { amount: number; count: number }>()

  let totalExpenses = 0
  let totalRevenue = 0

  for (const doc of docs) {
    if (!doc.total_amount || doc.total_amount <= 0) continue
    const category = doc.category ?? "Bez kategórie"
    const isExpense = expenseTypes.has(doc.document_type ?? "")
    const map = isExpense ? expenseMap : revenueMap

    const entry = map.get(category) ?? { amount: 0, count: 0 }
    entry.amount += doc.total_amount
    entry.count++
    map.set(category, entry)

    if (isExpense) totalExpenses += doc.total_amount
    else totalRevenue += doc.total_amount
  }

  // Add invoice revenue
  if (invoiceTotal > 0) {
    const entry = revenueMap.get("Vydané faktúry") ?? { amount: 0, count: 0 }
    entry.amount += invoiceTotal
    entry.count += invoiceCount
    revenueMap.set("Vydané faktúry", entry)
    totalRevenue += invoiceTotal
  }

  const buildRows = (map: Map<string, { amount: number; count: number }>, total: number): PLRow[] =>
    Array.from(map.entries())
      .map(([label, data]) => ({
        label,
        amount: Number(data.amount.toFixed(2)),
        transactionCount: data.count,
        percentage: total > 0 ? Number(((data.amount / total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.amount - a.amount)

  const netProfit = totalRevenue - totalExpenses

  return {
    period,
    currency,
    entityType: tag.tag_type as "client" | "project",
    entityName: tag.name,
    entityTagId: tag.id,
    revenue: buildRows(revenueMap, totalRevenue),
    expenses: buildRows(expenseMap, totalExpenses),
    totalRevenue: Number(totalRevenue.toFixed(2)),
    totalExpenses: Number(totalExpenses.toFixed(2)),
    netProfit: Number(netProfit.toFixed(2)),
    margin: totalRevenue > 0 ? Number(((netProfit / totalRevenue) * 100).toFixed(1)) : 0,
  }
}

/**
 * Generate P&L summary for all tags of a given type.
 */
export async function generateAllTagsPLSummary(
  supabase: SupabaseClient,
  organizationId: string,
  tagType: "client" | "project",
  period: ReportPeriod,
  currency: string = "EUR"
): Promise<PLReport[]> {
  const { data: tags } = await supabase
    .from("tags")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("tag_type", tagType)

  if (!tags || tags.length === 0) return []

  const reports: PLReport[] = []
  for (const tag of tags as unknown as { id: string }[]) {
    const report = await generateTagPL(supabase, organizationId, tag.id, period, currency)
    if (report) reports.push(report)
  }

  return reports.sort((a, b) => b.netProfit - a.netProfit)
}
