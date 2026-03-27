"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"
import { generateKvDphXml, type KvDphInvoice } from "./xml/kv-dph"
import { generateDpDphXml } from "./xml/dp-dph"
import { generateDpTypeBXml } from "./xml/dp-type-b"
import { generateUblInvoiceXml } from "./xml/peppol-ubl"
import { SLOVAK_TAX_CONFIG_2026 } from "@vexera/utils"
import type { Database } from "@vexera/types"

// ─── KV DPH Export ────────────────────────────────────────────────────────────

export async function exportKvDphAction(year: number, month: number) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  // 1. Fetch org
  const { data: org, error: orgError } = await supabase
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

  const { data: invoices, error: invError } = await supabase
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
  const contactIds = [...new Set(invoices.map((i) => i.contact_id).filter((id): id is string => id != null))]
  let contactMap = new Map<string, string | null>()
  if (contactIds.length > 0) {
    const { data: contacts } = await supabase
      .from("contacts")
      .select("id, ic_dph")
      .in("id", contactIds)

    if (contacts) {
      for (const c of contacts) {
        contactMap.set(c.id, c.ic_dph ?? null)
      }
    }
  }

  // 4. Fetch invoice_items for per-rate breakdown
  const invoiceIds = invoices.map((i) => i.id)
  const { data: items } = await supabase
    .from("invoice_items")
    .select("invoice_id, vat_rate, vat_amount, unit_price, quantity")
    .in("invoice_id", invoiceIds)

  type InvoiceItem = { invoice_id: string; vat_rate: number; vat_amount: number; unit_price: number; quantity: number }
  const itemsByInvoice = new Map<string, InvoiceItem[]>()
  if (items) {
    for (const item of items) {
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

  for (const inv of invoices) {
    const invItems = itemsByInvoice.get(inv.id) ?? []
    const kvInvoice: KvDphInvoice = {
      counterpartyIcDph: inv.contact_id ? contactMap.get(inv.contact_id) ?? null : null,
      invoiceNumber: inv.invoice_number ?? "",
      date: inv.issue_date ?? "",
      items: invItems.map((item) => ({
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
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("dic, ic_dph, name, address_street, address_city, address_zip")
    .eq("id", orgId)
    .single()

  if (orgError || !org) return { error: orgError?.message ?? "Organization not found" }

  // 2. Fetch vat_return for the period
  const { data: vatReturn, error: vrError } = await supabase
    .from("vat_returns")
    .select("*")
    .eq("organization_id", orgId)
    .eq("period_year", year)
    .eq("period_month", month)
    .single()

  if (vrError || !vatReturn) return { error: vrError?.message ?? "VAT return not found" }

  const vr = vatReturn as Database["public"]["Tables"]["vat_returns"]["Row"]

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
      vat_output_23: Number(vr.vat_output_23 ?? 0),
      vat_output_19: Number(vr.vat_output_19 ?? 0),
      vat_output_5: Number(vr.vat_output_5 ?? 0),
      vat_input_23: Number(vr.vat_input_23 ?? 0),
      vat_input_19: Number(vr.vat_input_19 ?? 0),
      vat_input_5: Number(vr.vat_input_5 ?? 0),
      total_output_vat: Number(vr.total_output_vat ?? 0),
      total_input_vat: Number(vr.total_input_vat ?? 0),
      vat_liability: Number(vr.vat_liability ?? 0),
      taxable_base_output: Number(vr.taxable_base_output ?? 0),
      taxable_base_input: Number(vr.taxable_base_input ?? 0),
    },
  })

  return { xml, filename: `DP_DPH_${year}_${String(month).padStart(2, "0")}.xml` }
}

// ─── Income Tax (DP Type B) Export ────────────────────────────────────────────

export async function exportIncomeTaxAction(year: number) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  // 1. Fetch org + user profile
  const { data: org, error: orgError } = await supabase
    .from("organizations")
    .select("dic, name, address_street, address_city, address_zip")
    .eq("id", orgId)
    .single()

  if (orgError || !org) return { error: orgError?.message ?? "Organization not found" }

  // 2. Fetch freelancer_profiles for tax regime
  const { data: profile } = await supabase
    .from("freelancer_profiles")
    .select("tax_regime")
    .eq("organization_id", orgId)
    .single()

  const taxRegime: "pausalne_vydavky" | "naklady" =
    profile?.tax_regime === "naklady" ? "naklady" : "pausalne_vydavky"
  const prepayments = 0 // prepayments tracking not yet implemented

  // 3. Fetch YTD income (sum of issued invoices)
  const yearStart = `${year}-01-01`
  const yearEnd = `${year + 1}-01-01`

  const { data: issuedInvoices } = await supabase
    .from("invoices")
    .select("total")
    .eq("organization_id", orgId)
    .eq("invoice_type", "issued")
    .gte("issue_date", yearStart)
    .lt("issue_date", yearEnd)

  const income = (issuedInvoices ?? []).reduce(
    (sum, inv) => sum + Number(inv.total ?? 0),
    0
  )

  // 4. Fetch YTD expenses (sum of received invoices + documents)
  const { data: receivedInvoices } = await supabase
    .from("invoices")
    .select("total")
    .eq("organization_id", orgId)
    .eq("invoice_type", "received")
    .gte("issue_date", yearStart)
    .lt("issue_date", yearEnd)

  const invoiceExpenses = (receivedInvoices ?? []).reduce(
    (sum, inv) => sum + Number(inv.total ?? 0),
    0
  )

  const { data: documents } = await supabase
    .from("documents")
    .select("total_amount")
    .eq("organization_id", orgId)
    .gte("issue_date", yearStart)
    .lt("issue_date", yearEnd)

  const documentExpenses = (documents ?? []).reduce(
    (sum, doc) => sum + Number(doc.total_amount ?? 0),
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

// ─── Peppol UBL 2.1 Export ──────────────────────────────────────────────────

export async function exportPeppolUblAction(invoiceId: string) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  // 1. Fetch invoice with items
  const { data: invoice, error: invError } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("id", invoiceId)
    .eq("organization_id", orgId)
    .single()

  if (invError || !invoice) return { error: invError?.message ?? "Invoice not found" }

  type InvoiceRow = Database["public"]["Tables"]["invoices"]["Row"]
  type ItemRow = Database["public"]["Tables"]["invoice_items"]["Row"]
  const inv = invoice as InvoiceRow & { invoice_items: ItemRow[] }

  // 2. Map to UblInvoiceInput and generate XML
  const items = (inv.invoice_items ?? []).map((item) => ({
    description: item.description ?? "",
    quantity: Number(item.quantity ?? 1),
    unit: item.unit ?? "C62",
    unit_price: Number(item.unit_price ?? 0),
    vat_rate: Number(item.vat_rate ?? 0),
    vat_amount: Number(item.vat_amount ?? 0),
    total_price: Number(item.total ?? 0),
  }))

  const xml = generateUblInvoiceXml({
    invoice: {
      invoice_number: inv.invoice_number ?? "",
      issue_date: inv.issue_date ?? "",
      due_date: inv.due_date ?? "",
      notes: inv.notes ?? undefined,
      total_amount: Number(inv.total ?? 0),
      vat_amount: Number(inv.vat_amount ?? 0),
      supplier_name: inv.supplier_name ?? "",
      supplier_ico: inv.supplier_ico ?? undefined,
      supplier_ic_dph: inv.supplier_ic_dph ?? undefined,
      supplier_street: inv.supplier_address ?? undefined,
      supplier_city: undefined,
      supplier_zip: undefined,
      customer_name: inv.customer_name ?? "",
      customer_ico: inv.customer_ico ?? undefined,
      customer_ic_dph: inv.customer_ic_dph ?? undefined,
      customer_street: inv.customer_address ?? undefined,
      customer_city: undefined,
      customer_zip: undefined,
      bank_iban: inv.bank_iban ?? inv.supplier_iban ?? undefined,
      variable_symbol: inv.variable_symbol ?? undefined,
      items,
    },
  })

  const invoiceNumber = (inv.invoice_number ?? "invoice").replace(/[^a-zA-Z0-9_-]/g, "_")
  return { xml, filename: `UBL_${invoiceNumber}.xml` }
}
