"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { generateKvDphXml, type KvDphInvoice } from "@/lib/services/xml/kv-dph"
import { generateDpDphXml } from "@/lib/services/xml/dp-dph"
import { generateDpTypeBXml } from "@/lib/services/xml/dp-type-b"
import { SLOVAK_TAX_CONFIG_2026 } from "@vexera/utils"

// ─── KV DPH Export ────────────────────────────────────────────────────────────

export async function exportKvDphAction(year: number, month: number) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  // 1. Fetch org
  const { data: org, error: orgError } = await (supabase as any)
    .from("organizations")
    .select("dic, ic_dph")
    .eq("id", orgId)
    .single()

  if (orgError || !org) return { error: orgError?.message ?? "Organization not found" }

  // 2. Fetch invoices for the period
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`

  const { data: invoices, error: invError } = await (supabase as any)
    .from("invoices")
    .select("id, invoice_number, invoice_type, issue_date, contact_id")
    .eq("organization_id", orgId)
    .gte("issue_date", startDate)
    .lt("issue_date", endDate)

  if (invError) return { error: invError.message }
  if (!invoices || invoices.length === 0) {
    return { error: "No invoices found for this period" }
  }

  // 3. Fetch contacts for ic_dph lookup
  const contactIds = [...new Set((invoices as any[]).map((i: any) => i.contact_id).filter(Boolean))]
  let contactMap = new Map<string, string | null>()
  if (contactIds.length > 0) {
    const { data: contacts } = await (supabase as any)
      .from("contacts")
      .select("id, ic_dph")
      .in("id", contactIds)

    if (contacts) {
      for (const c of contacts as any[]) {
        contactMap.set(c.id, c.ic_dph ?? null)
      }
    }
  }

  // 4. Fetch invoice_items for per-rate breakdown
  const invoiceIds = (invoices as any[]).map((i: any) => i.id)
  const { data: items } = await (supabase as any)
    .from("invoice_items")
    .select("invoice_id, vat_rate, vat_amount, unit_price, quantity")
    .in("invoice_id", invoiceIds)

  const itemsByInvoice = new Map<string, any[]>()
  if (items) {
    for (const item of items as any[]) {
      const list = itemsByInvoice.get(item.invoice_id) ?? []
      list.push(item)
      itemsByInvoice.set(item.invoice_id, list)
    }
  }

  // 5. Build KvDphInvoice arrays
  const issuedInvoices: KvDphInvoice[] = []
  const receivedInvoices: KvDphInvoice[] = []
  const creditNotesIssued: KvDphInvoice[] = []
  const creditNotesReceived: KvDphInvoice[] = []

  for (const inv of invoices as any[]) {
    const invItems = itemsByInvoice.get(inv.id) ?? []
    const kvInvoice: KvDphInvoice = {
      counterpartyIcDph: inv.contact_id ? contactMap.get(inv.contact_id) ?? null : null,
      invoiceNumber: inv.invoice_number ?? "",
      date: inv.issue_date ?? "",
      items: invItems.map((item: any) => ({
        taxBase: Number(item.unit_price ?? 0) * Number(item.quantity ?? 1),
        vatAmount: Number(item.vat_amount ?? 0),
        vatRate: Number(item.vat_rate ?? 0),
      })),
    }

    if (inv.invoice_type === "credit_note") {
      // Determine direction from original context: if it has items that look like output, it's issued
      // Simple heuristic: credit notes are categorized the same way
      // For now, treat credit notes without contact IC DPH as issued
      if (kvInvoice.counterpartyIcDph) {
        creditNotesIssued.push(kvInvoice)
      } else {
        creditNotesReceived.push(kvInvoice)
      }
    } else if (inv.invoice_type === "issued") {
      issuedInvoices.push(kvInvoice)
    } else {
      receivedInvoices.push(kvInvoice)
    }
  }

  // 6. Generate XML
  const xml = generateKvDphXml({
    organization: { dic: org.dic ?? "", ic_dph: org.ic_dph ?? "" },
    year,
    month,
    filingType: "R",
    issuedInvoices,
    receivedInvoices,
    creditNotesIssued,
    creditNotesReceived,
  })

  return { xml, filename: `KV_DPH_${year}_${String(month).padStart(2, "0")}.xml` }
}

// ─── DP DPH Export ────────────────────────────────────────────────────────────

export async function exportDpDphAction(year: number, month: number) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  // 1. Fetch org details
  const { data: org, error: orgError } = await (supabase as any)
    .from("organizations")
    .select("dic, ic_dph, name, address_street, address_city, address_zip")
    .eq("id", orgId)
    .single()

  if (orgError || !org) return { error: orgError?.message ?? "Organization not found" }

  // 2. Fetch vat_return for the period
  const { data: vatReturn, error: vrError } = await (supabase as any)
    .from("vat_returns")
    .select("*")
    .eq("organization_id", orgId)
    .eq("period_year", year)
    .eq("period_month", month)
    .single()

  if (vrError || !vatReturn) return { error: vrError?.message ?? "VAT return not found" }

  // 3. Generate XML
  const xml = generateDpDphXml({
    organization: {
      dic: org.dic ?? "",
      ic_dph: org.ic_dph ?? "",
      name: org.name ?? "",
      address_street: org.address_street ?? "",
      address_city: org.address_city ?? "",
      address_zip: org.address_zip ?? "",
    },
    year,
    month,
    filingType: "R",
    vatReturn: {
      vat_output_23: Number(vatReturn.vat_output_23 ?? 0),
      vat_output_19: Number(vatReturn.vat_output_19 ?? 0),
      vat_output_5: Number(vatReturn.vat_output_5 ?? 0),
      vat_input_23: Number(vatReturn.vat_input_23 ?? 0),
      vat_input_19: Number(vatReturn.vat_input_19 ?? 0),
      vat_input_5: Number(vatReturn.vat_input_5 ?? 0),
      total_output_vat: Number(vatReturn.total_output_vat ?? 0),
      total_input_vat: Number(vatReturn.total_input_vat ?? 0),
      vat_liability: Number(vatReturn.vat_liability ?? 0),
      taxable_base_output: Number(vatReturn.taxable_base_output ?? 0),
      taxable_base_input: Number(vatReturn.taxable_base_input ?? 0),
    },
  })

  return { xml, filename: `DP_DPH_${year}_${String(month).padStart(2, "0")}.xml` }
}

// ─── Income Tax (DP Type B) Export ────────────────────────────────────────────

export async function exportIncomeTaxAction(year: number) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  // 1. Fetch org + user profile
  const { data: org, error: orgError } = await (supabase as any)
    .from("organizations")
    .select("dic, name, address_street, address_city, address_zip")
    .eq("id", orgId)
    .single()

  if (orgError || !org) return { error: orgError?.message ?? "Organization not found" }

  // 2. Fetch freelancer_profiles for tax regime
  const { data: profile } = await (supabase as any)
    .from("freelancer_profiles")
    .select("tax_regime, prepayments_total")
    .eq("organization_id", orgId)
    .single()

  const taxRegime: "pausalne_vydavky" | "naklady" =
    profile?.tax_regime === "naklady" ? "naklady" : "pausalne_vydavky"
  const prepayments = Number(profile?.prepayments_total ?? 0)

  // 3. Fetch YTD income (sum of issued invoices)
  const yearStart = `${year}-01-01`
  const yearEnd = `${year + 1}-01-01`

  const { data: issuedInvoices } = await (supabase as any)
    .from("invoices")
    .select("total_amount")
    .eq("organization_id", orgId)
    .eq("invoice_type", "issued")
    .gte("issue_date", yearStart)
    .lt("issue_date", yearEnd)

  const income = (issuedInvoices ?? []).reduce(
    (sum: number, inv: any) => sum + Number(inv.total_amount ?? 0),
    0
  )

  // 4. Fetch YTD expenses (sum of received invoices + documents)
  const { data: receivedInvoices } = await (supabase as any)
    .from("invoices")
    .select("total_amount")
    .eq("organization_id", orgId)
    .eq("invoice_type", "received")
    .gte("issue_date", yearStart)
    .lt("issue_date", yearEnd)

  const invoiceExpenses = (receivedInvoices ?? []).reduce(
    (sum: number, inv: any) => sum + Number(inv.total_amount ?? 0),
    0
  )

  const { data: documents } = await (supabase as any)
    .from("documents")
    .select("amount")
    .eq("organization_id", orgId)
    .gte("date", yearStart)
    .lt("date", yearEnd)

  const documentExpenses = (documents ?? []).reduce(
    (sum: number, doc: any) => sum + Number(doc.amount ?? 0),
    0
  )

  const expenses = invoiceExpenses + documentExpenses

  // 5. Generate XML
  const xml = generateDpTypeBXml({
    taxpayer: {
      dic: org.dic ?? "",
      full_name: org.name ?? "",
      address_street: org.address_street ?? "",
      address_city: org.address_city ?? "",
      address_zip: org.address_zip ?? "",
    },
    year,
    filingType: "R",
    income,
    expenses,
    taxRegime,
    taxConfig: SLOVAK_TAX_CONFIG_2026,
    prepayments,
  })

  return { xml, filename: `DP_FO_B_${year}.xml` }
}
