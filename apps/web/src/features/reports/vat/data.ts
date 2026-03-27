import { createClient } from "@/lib/supabase/server"

export type VatSummary = {
  period_label: string       // e.g. "Q1 2026"
  vat_output_23: number
  vat_output_19: number
  vat_output_5: number
  vat_input_23: number
  vat_input_19: number
  vat_input_5: number
  total_output_vat: number
  total_input_vat: number
  vat_liability: number      // positive = owe, negative = refund
  taxable_base_output: number
  taxable_base_input: number
  document_count: number
}

export type VatTimelinePoint = {
  quarter: string   // "Q1 2026"
  output: number
  input: number
  liability: number
}

export async function getCurrentQuarterVat(orgId: string): Promise<VatSummary> {
  const supabase = await createClient()
  const now = new Date()
  const year = now.getFullYear()
  const quarter = Math.ceil((now.getMonth() + 1) / 3)

  // Quarter date range
  const qStartMonth = (quarter - 1) * 3
  const qStart = new Date(year, qStartMonth, 1).toISOString().split("T")[0]!
  const qEnd = new Date(year, qStartMonth + 3, 0).toISOString().split("T")[0]!

  // Get approved/archived documents with VAT data for this quarter
  const { data: docs } = await supabase
    .from("documents")
    .select("document_type, total_amount, vat_amount, vat_rate")
    .eq("organization_id", orgId)
    .in("status", ["approved", "archived"])
    .gte("issue_date", qStart)
    .lte("issue_date", qEnd)
    .is("deleted_at", null)
    .is("invoice_id", null)  // exclude docs linked to invoices to avoid double-counting

  // Get invoices for this quarter (for taxable base calculations)
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_type, total, vat_amount")
    .eq("organization_id", orgId)
    .in("status", ["paid", "sent", "overdue"])
    .gte("issue_date", qStart)
    .lte("issue_date", qEnd)
    .is("deleted_at", null)

  type DocRow = { document_type: string | null; total_amount: number | null; vat_amount: number | null; vat_rate: number | null }
  type InvRow = { id: string; invoice_type: string; total: number | null; vat_amount: number | null }

  const docRows = (docs ?? []) as unknown as DocRow[]
  const invRows = (invoices ?? []) as unknown as InvRow[]

  // Get invoice items with per-line VAT rates for proper bucketing
  const invoiceIds = invRows.map(i => i.id)
  const invoiceTypeMap = new Map(invRows.map(i => [i.id, i.invoice_type]))

  type ItemRow = { invoice_id: string; vat_rate: number | null; vat_amount: number | null }
  let itemRows: ItemRow[] = []
  if (invoiceIds.length > 0) {
    const { data: items } = await supabase
      .from("invoice_items")
      .select("invoice_id, vat_rate, vat_amount")
      .in("invoice_id", invoiceIds)
    itemRows = (items ?? []) as unknown as ItemRow[]
  }

  // Initialize VAT buckets
  const vat = {
    output_23: 0, output_19: 0, output_5: 0,
    input_23: 0, input_19: 0, input_5: 0,
    base_output: 0, base_input: 0,
  }

  // Process documents
  for (const doc of docRows) {
    const vatAmt = Number(doc.vat_amount) || 0
    const totalAmt = Number(doc.total_amount) || 0
    const rate = doc.vat_rate != null ? Number(doc.vat_rate) : null

    const isOutput = doc.document_type === "invoice_issued" || doc.document_type === "tax_document"
    const isInput = doc.document_type === "invoice_received" || doc.document_type === "receipt"

    if (isOutput) {
      vat.base_output += totalAmt - vatAmt
      if (rate === 23) vat.output_23 += vatAmt
      else if (rate === 19) vat.output_19 += vatAmt
      else if (rate === 5) vat.output_5 += vatAmt
      // 0% and null rates: no VAT to bucket (exempt/zero-rated)
    } else if (isInput) {
      vat.base_input += totalAmt - vatAmt
      if (rate === 23) vat.input_23 += vatAmt
      else if (rate === 19) vat.input_19 += vatAmt
      else if (rate === 5) vat.input_5 += vatAmt
    }
  }

  // Process invoice-level totals for taxable base
  for (const inv of invRows) {
    const vatAmt = Number(inv.vat_amount) || 0
    const totalAmt = Number(inv.total) || 0

    if (inv.invoice_type === "issued") {
      vat.base_output += totalAmt - vatAmt
    } else {
      vat.base_input += totalAmt - vatAmt
    }
  }

  // Process invoice items with actual per-line VAT rates for bucketing
  for (const item of itemRows) {
    const vatAmt = Number(item.vat_amount) || 0
    const rate = item.vat_rate != null ? Number(item.vat_rate) : null
    const invoiceType = invoiceTypeMap.get(item.invoice_id)

    if (invoiceType === "issued") {
      if (rate === 23) vat.output_23 += vatAmt
      else if (rate === 19) vat.output_19 += vatAmt
      else if (rate === 5) vat.output_5 += vatAmt
    } else {
      if (rate === 23) vat.input_23 += vatAmt
      else if (rate === 19) vat.input_19 += vatAmt
      else if (rate === 5) vat.input_5 += vatAmt
    }
  }

  const totalOutput = vat.output_23 + vat.output_19 + vat.output_5
  const totalInput = vat.input_23 + vat.input_19 + vat.input_5

  return {
    period_label: `Q${quarter} ${year}`,
    vat_output_23: round(vat.output_23),
    vat_output_19: round(vat.output_19),
    vat_output_5: round(vat.output_5),
    vat_input_23: round(vat.input_23),
    vat_input_19: round(vat.input_19),
    vat_input_5: round(vat.input_5),
    total_output_vat: round(totalOutput),
    total_input_vat: round(totalInput),
    vat_liability: round(totalOutput - totalInput),
    taxable_base_output: round(vat.base_output),
    taxable_base_input: round(vat.base_input),
    document_count: docRows.length + invRows.length,
  }
}

export async function getVatTimeline(orgId: string, periods = 4): Promise<VatTimelinePoint[]> {
  const supabase = await createClient()
  const now = new Date()
  const timeline: VatTimelinePoint[] = []

  for (let i = periods - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setMonth(d.getMonth() - i * 3)
    const year = d.getFullYear()
    const quarter = Math.ceil((d.getMonth() + 1) / 3)

    // Check for pre-computed VAT return
    const { data } = await supabase
      .from("vat_returns")
      .select("total_output_vat, total_input_vat, vat_liability")
      .eq("organization_id", orgId)
      .eq("period_year", year)
      .eq("period_month", (quarter - 1) * 3 + 1)
      .single()

    if (data) {
      const row = data as unknown as { total_output_vat: number; total_input_vat: number; vat_liability: number }
      timeline.push({
        quarter: `Q${quarter} ${year}`,
        output: Number(row.total_output_vat) || 0,
        input: Number(row.total_input_vat) || 0,
        liability: Number(row.vat_liability) || 0,
      })
    } else {
      timeline.push({
        quarter: `Q${quarter} ${year}`,
        output: 0,
        input: 0,
        liability: 0,
      })
    }
  }

  return timeline
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
