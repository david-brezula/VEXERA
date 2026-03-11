/**
 * VAT pre-calculation service (Slovak tax rules).
 *
 * - calculateVatReturn    — compute VAT position for a given quarter
 * - getCurrentQuarterVat  — convenience for current quarter
 * - getVatTimeline        — last N quarters for trend chart
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { VatReturn } from "@vexera/types"

// ─── helpers ────────────────────────────────────────────────────────────────

/** Returns { start, end } ISO date strings for a given year+quarter. */
function quarterRange(year: number, quarter: number) {
  const startMonth = (quarter - 1) * 3 // 0-indexed: 0, 3, 6, 9
  const start = new Date(year, startMonth, 1)
  const end = new Date(year, startMonth + 3, 0) // last day of last month in quarter
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  }
}

function currentQuarter(): { year: number; quarter: number } {
  const now = new Date()
  return {
    year: now.getFullYear(),
    quarter: Math.ceil((now.getMonth() + 1) / 3),
  }
}

// ─── calculateVatReturn ─────────────────────────────────────────────────────

export async function calculateVatReturn(
  supabase: SupabaseClient,
  orgId: string,
  year: number,
  quarter: number,
): Promise<VatReturn> {
  const { start, end } = quarterRange(year, quarter)

  // 1. Get approved/archived documents in this quarter
  const { data: docs, error: docsErr } = await supabase
    .from("documents")
    .select(
      "id, document_type, total_amount, vat_amount, vat_rate, issue_date, status",
    )
    .eq("organization_id", orgId)
    .in("status", ["approved", "archived", "auto_processed"])
    .gte("issue_date", start)
    .lte("issue_date", end)
    .is("deleted_at", null)

  if (docsErr)
    throw new Error(`Failed to fetch documents: ${docsErr.message}`)

  type DocRow = {
    id: string
    document_type: string | null
    total_amount: number | null
    vat_amount: number | null
    vat_rate: number | null
    issue_date: string | null
    status: string | null
  }
  const docRows = (docs ?? []) as DocRow[]

  // 2. Also get invoices for the same period (may not have documents)
  const { data: invoices, error: invErr } = await supabase
    .from("invoices")
    .select("id, invoice_type, total, vat_amount, issue_date")
    .eq("organization_id", orgId)
    .gte("issue_date", start)
    .lte("issue_date", end)
    .is("deleted_at", null)

  if (invErr)
    throw new Error(`Failed to fetch invoices: ${invErr.message}`)

  type InvRow = {
    id: string
    invoice_type: string | null
    total: number | null
    vat_amount: number | null
    issue_date: string | null
  }
  const invRows = (invoices ?? []) as InvRow[]

  // 2b. Get invoice items with per-line VAT rates for proper bucketing
  const invoiceIds = invRows.map(i => i.id)
  const invoiceTypeMap = new Map(invRows.map(i => [i.id, i.invoice_type]))

  type ItemRow = { invoice_id: string; vat_rate: number | null; vat_amount: number | null }
  let itemRows: ItemRow[] = []
  if (invoiceIds.length > 0) {
    const { data: items, error: itemsErr } = await supabase
      .from("invoice_items")
      .select("invoice_id, vat_rate, vat_amount")
      .in("invoice_id", invoiceIds)
    if (itemsErr)
      throw new Error(`Failed to fetch invoice items: ${itemsErr.message}`)
    itemRows = (items ?? []) as ItemRow[]
  }

  // 3. Accumulate VAT by rate and direction
  //    Output = invoice_issued documents / issued invoices
  //    Input  = invoice_received documents / received invoices
  const vatBuckets = {
    output_20: 0,
    output_10: 0,
    output_5: 0,
    input_20: 0,
    input_10: 0,
    input_5: 0,
    base_output: 0,
    base_input: 0,
  }

  // Track processed entity IDs to avoid double-counting when both doc and invoice exist
  const processedIds = new Set<string>()

  // Process documents first (they have OCR-verified data)
  for (const doc of docRows) {
    processedIds.add(doc.id)
    const vatAmount = Number(doc.vat_amount) || 0
    const totalAmount = Number(doc.total_amount) || 0
    const rate = Number(doc.vat_rate) || 20
    const isOutput = doc.document_type === "invoice_issued"

    if (isOutput) {
      vatBuckets.base_output += totalAmount - vatAmount
      if (rate === 20) vatBuckets.output_20 += vatAmount
      else if (rate === 10) vatBuckets.output_10 += vatAmount
      else if (rate === 5) vatBuckets.output_5 += vatAmount
    } else if (
      doc.document_type === "invoice_received" ||
      doc.document_type === "receipt"
    ) {
      vatBuckets.base_input += totalAmount - vatAmount
      if (rate === 20) vatBuckets.input_20 += vatAmount
      else if (rate === 10) vatBuckets.input_10 += vatAmount
      else if (rate === 5) vatBuckets.input_5 += vatAmount
    }
  }

  // Process invoice-level totals for taxable base (skip already-processed documents)
  for (const inv of invRows) {
    if (processedIds.has(inv.id)) continue
    const vatAmount = Number(inv.vat_amount) || 0
    const total = Number(inv.total) || 0
    const isOutput = inv.invoice_type === "issued"

    if (isOutput) {
      vatBuckets.base_output += total - vatAmount
    } else {
      vatBuckets.base_input += total - vatAmount
    }
  }

  // Process invoice items with actual per-line VAT rates for bucketing
  for (const item of itemRows) {
    // Skip items belonging to invoices already processed via documents
    if (processedIds.has(item.invoice_id)) continue
    const vatAmount = Number(item.vat_amount) || 0
    const rate = Number(item.vat_rate) || 20
    const isOutput = invoiceTypeMap.get(item.invoice_id) === "issued"

    if (isOutput) {
      if (rate === 20) vatBuckets.output_20 += vatAmount
      else if (rate === 10) vatBuckets.output_10 += vatAmount
      else if (rate === 5) vatBuckets.output_5 += vatAmount
    } else {
      if (rate === 20) vatBuckets.input_20 += vatAmount
      else if (rate === 10) vatBuckets.input_10 += vatAmount
      else if (rate === 5) vatBuckets.input_5 += vatAmount
    }
  }

  const totalOutputVat =
    vatBuckets.output_20 + vatBuckets.output_10 + vatBuckets.output_5
  const totalInputVat =
    vatBuckets.input_20 + vatBuckets.input_10 + vatBuckets.input_5
  const vatLiability = totalOutputVat - totalInputVat

  const round = (n: number) => Math.round(n * 100) / 100

  // 4. Upsert into vat_returns table
  const payload = {
    organization_id: orgId,
    period_year: year,
    period_quarter: quarter,
    vat_output_20: round(vatBuckets.output_20),
    vat_output_10: round(vatBuckets.output_10),
    vat_output_5: round(vatBuckets.output_5),
    vat_input_20: round(vatBuckets.input_20),
    vat_input_10: round(vatBuckets.input_10),
    vat_input_5: round(vatBuckets.input_5),
    total_output_vat: round(totalOutputVat),
    total_input_vat: round(totalInputVat),
    vat_liability: round(vatLiability),
    taxable_base_output: round(vatBuckets.base_output),
    taxable_base_input: round(vatBuckets.base_input),
    status: "draft" as const,
    document_count: docRows.length + invRows.filter((i) => !processedIds.has(i.id)).length,
    computed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data: upserted, error: upsertErr } = await supabase
    .from("vat_returns")
    .upsert(payload, {
      onConflict: "organization_id,period_year,period_quarter",
    })
    .select()
    .single()

  if (upsertErr) {
    console.warn("vat_returns upsert warning:", upsertErr.message)
    // Return a computed result even if upsert fails (table may not exist yet)
    return {
      id: "",
      ...payload,
      finalized_at: null,
      finalized_by: null,
      notes: null,
      created_at: new Date().toISOString(),
    } as VatReturn
  }

  return upserted as unknown as VatReturn
}

// ─── getCurrentQuarterVat ───────────────────────────────────────────────────

export async function getCurrentQuarterVat(
  supabase: SupabaseClient,
  orgId: string,
): Promise<VatReturn> {
  const { year, quarter } = currentQuarter()
  return calculateVatReturn(supabase, orgId, year, quarter)
}

// ─── getVatTimeline ─────────────────────────────────────────────────────────

export async function getVatTimeline(
  supabase: SupabaseClient,
  orgId: string,
  periods: number = 4,
): Promise<VatReturn[]> {
  // Try to read from the table first
  const { data: cached } = await supabase
    .from("vat_returns")
    .select("*")
    .eq("organization_id", orgId)
    .order("period_year", { ascending: false })
    .order("period_quarter", { ascending: false })
    .limit(periods)

  if (cached && cached.length >= periods) {
    return cached as unknown as VatReturn[]
  }

  // Otherwise compute each quarter on the fly
  const results: VatReturn[] = []
  let { year, quarter } = currentQuarter()

  for (let i = 0; i < periods; i++) {
    const vatReturn = await calculateVatReturn(supabase, orgId, year, quarter)
    results.push(vatReturn)

    // Move to previous quarter
    quarter -= 1
    if (quarter < 1) {
      quarter = 4
      year -= 1
    }
  }

  return results
}
