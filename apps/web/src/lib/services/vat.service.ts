/**
 * VAT pre-calculation service (Slovak tax rules).
 *
 * - calculateVatReturn    — compute VAT position for a given month
 * - getCurrentMonthVat    — convenience for current month
 * - getVatTimeline        — last N months for trend chart
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { VatReturn } from "@vexera/types"
import { getActiveVatRates } from "@/lib/services/legislative.service"

// ─── helpers ────────────────────────────────────────────────────────────────

/** Returns { start, end } ISO date strings for a given year+month. */
function monthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1) // month is 1-based
  const end = new Date(year, month, 0) // last day of month
  return {
    start: start.toISOString().split("T")[0],
    end: end.toISOString().split("T")[0],
  }
}

function currentMonth(): { year: number; month: number } {
  const now = new Date()
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
  }
}

/** Bucket a rate into standard/reduced_1/reduced_2 based on active legislative rates */
function bucketRate(
  rate: number,
  activeRates: number[],
): "standard" | "reduced_1" | "reduced_2" {
  // activeRates is sorted descending (e.g. [23, 19, 5, 0])
  const [standard = 23, reduced1 = 19] = activeRates
  // Threshold: midpoint between standard and reduced_1
  const threshold1 = (standard + reduced1) / 2
  // Threshold: midpoint between reduced_1 and 5
  const threshold2 = (reduced1 + 5) / 2

  if (rate >= threshold1) return "standard"
  if (rate >= threshold2) return "reduced_1"
  return "reduced_2"
}

// ─── calculateVatReturn ─────────────────────────────────────────────────────

export async function calculateVatReturn(
  supabase: SupabaseClient,
  orgId: string,
  year: number,
  month: number,
): Promise<VatReturn> {
  const { start, end } = monthRange(year, month)

  // Fetch active VAT rates from legislative rules
  const vatRateRules = await getActiveVatRates(supabase, "SK")
  const activeRates = vatRateRules.map((r) => r.rate).filter((r) => r > 0)
  // Fallback to default rates if legislative service returns empty
  const standardRate = activeRates[0] ?? 23
  const reducedRate1 = activeRates[1] ?? 19

  // 1. Get approved/archived documents in this month
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

  // 2. Also get invoices for the same period
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
  const invoiceIds = invRows.map((i) => i.id)
  const invoiceTypeMap = new Map(invRows.map((i) => [i.id, i.invoice_type]))

  type ItemRow = {
    invoice_id: string
    vat_rate: number | null
    vat_amount: number | null
  }
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

  // 3. Accumulate VAT by rate bucket and direction
  const vatBuckets = {
    output_standard: 0,
    output_reduced1: 0,
    output_5: 0,
    input_standard: 0,
    input_reduced1: 0,
    input_5: 0,
    base_output: 0,
    base_input: 0,
  }

  // Track processed entity IDs to avoid double-counting
  const processedIds = new Set<string>()

  // Process documents first (they have OCR-verified data)
  for (const doc of docRows) {
    processedIds.add(doc.id)
    const vatAmount = Number(doc.vat_amount) || 0
    const totalAmount = Number(doc.total_amount) || 0
    const rate = Number(doc.vat_rate) || standardRate
    const bucket = bucketRate(rate, activeRates)
    const isOutput = doc.document_type === "invoice_issued"

    if (isOutput) {
      vatBuckets.base_output += totalAmount - vatAmount
      if (bucket === "standard") vatBuckets.output_standard += vatAmount
      else if (bucket === "reduced_1") vatBuckets.output_reduced1 += vatAmount
      else vatBuckets.output_5 += vatAmount
    } else if (
      doc.document_type === "invoice_received" ||
      doc.document_type === "receipt"
    ) {
      vatBuckets.base_input += totalAmount - vatAmount
      if (bucket === "standard") vatBuckets.input_standard += vatAmount
      else if (bucket === "reduced_1") vatBuckets.input_reduced1 += vatAmount
      else vatBuckets.input_5 += vatAmount
    }
  }

  // Process invoice-level totals for taxable base (skip already-processed)
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
    if (processedIds.has(item.invoice_id)) continue
    const vatAmount = Number(item.vat_amount) || 0
    const rate = Number(item.vat_rate) || standardRate
    const bucket = bucketRate(rate, activeRates)
    const isOutput = invoiceTypeMap.get(item.invoice_id) === "issued"

    if (isOutput) {
      if (bucket === "standard") vatBuckets.output_standard += vatAmount
      else if (bucket === "reduced_1") vatBuckets.output_reduced1 += vatAmount
      else vatBuckets.output_5 += vatAmount
    } else {
      if (bucket === "standard") vatBuckets.input_standard += vatAmount
      else if (bucket === "reduced_1") vatBuckets.input_reduced1 += vatAmount
      else vatBuckets.input_5 += vatAmount
    }
  }

  const totalOutputVat =
    vatBuckets.output_standard + vatBuckets.output_reduced1 + vatBuckets.output_5
  const totalInputVat =
    vatBuckets.input_standard + vatBuckets.input_reduced1 + vatBuckets.input_5
  const vatLiability = totalOutputVat - totalInputVat

  const round = (n: number) => Math.round(n * 100) / 100

  // 4. Upsert into vat_returns table
  const payload = {
    organization_id: orgId,
    period_year: year,
    period_month: month,
    vat_output_23: round(vatBuckets.output_standard),
    vat_output_19: round(vatBuckets.output_reduced1),
    vat_output_5: round(vatBuckets.output_5),
    vat_input_23: round(vatBuckets.input_standard),
    vat_input_19: round(vatBuckets.input_reduced1),
    vat_input_5: round(vatBuckets.input_5),
    total_output_vat: round(totalOutputVat),
    total_input_vat: round(totalInputVat),
    vat_liability: round(vatLiability),
    taxable_base_output: round(vatBuckets.base_output),
    taxable_base_input: round(vatBuckets.base_input),
    status: "draft" as const,
    document_count:
      docRows.length +
      invRows.filter((i) => !processedIds.has(i.id)).length,
    computed_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data: upserted, error: upsertErr } = await (supabase as any)
    .from("vat_returns")
    .upsert(payload, {
      onConflict: "organization_id,period_year,period_month",
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

// ─── getCurrentMonthVat ─────────────────────────────────────────────────────

export async function getCurrentMonthVat(
  supabase: SupabaseClient,
  orgId: string,
): Promise<VatReturn> {
  const { year, month } = currentMonth()
  return calculateVatReturn(supabase, orgId, year, month)
}

/** @deprecated Use getCurrentMonthVat instead */
export const getCurrentQuarterVat = getCurrentMonthVat

// ─── getVatTimeline ─────────────────────────────────────────────────────────

export async function getVatTimeline(
  supabase: SupabaseClient,
  orgId: string,
  periods: number = 12,
): Promise<VatReturn[]> {
  // Try to read from the table first
  const { data: cached } = await (supabase as any)
    .from("vat_returns")
    .select("*")
    .eq("organization_id", orgId)
    .order("period_year", { ascending: false })
    .order("period_month", { ascending: false })
    .limit(periods)

  if (cached && cached.length >= periods) {
    return cached as unknown as VatReturn[]
  }

  // Otherwise compute each month on the fly
  const results: VatReturn[] = []
  let { year, month } = currentMonth()

  for (let i = 0; i < periods; i++) {
    const vatReturn = await calculateVatReturn(supabase, orgId, year, month)
    results.push(vatReturn)

    // Move to previous month
    month -= 1
    if (month < 1) {
      month = 12
      year -= 1
    }
  }

  return results
}
