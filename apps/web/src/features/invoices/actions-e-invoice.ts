"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"
import { parseUblInvoiceXml, type ParsedInvoice } from "@/features/export/xml/parse-ubl"
import { parseCiiInvoiceXml } from "@/features/export/xml/parse-cii"

export async function importEInvoiceAction(xmlContent: string) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // 1. Detect format by checking root element
  const isUbl = xmlContent.includes("<Invoice") && xmlContent.includes("urn:oasis:names:specification:ubl")
  const isCii = xmlContent.includes("CrossIndustryInvoice")

  let parsed: ParsedInvoice
  if (isUbl) {
    parsed = parseUblInvoiceXml(xmlContent)
  } else if (isCii) {
    parsed = parseCiiInvoiceXml(xmlContent)
  } else {
    return { error: "Unsupported e-invoice format. Expected UBL 2.1 or CII." }
  }

  // 2. Try to match supplier against contacts (by ic_dph or ico)
  let contactId: string | null = null
  if (parsed.supplierIcDph) {
    const { data: contact } = await supabase.from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("ic_dph", parsed.supplierIcDph)
      .limit(1)
      .single()
    if (contact) contactId = contact.id
  }
  if (!contactId && parsed.supplierIco) {
    const { data: contact } = await supabase.from("contacts")
      .select("id")
      .eq("organization_id", orgId)
      .eq("ico", parsed.supplierIco)
      .limit(1)
      .single()
    if (contact) contactId = contact.id
  }

  // 3. Create received invoice
  const { data: invoice, error: invoiceError } = await supabase
    .from("invoices")
    .insert({
      organization_id: orgId,
      invoice_number: parsed.invoiceNumber,
      invoice_type: "received",
      status: "draft",
      supplier_name: parsed.supplierName,
      supplier_ico: parsed.supplierIco || null,
      supplier_ic_dph: parsed.supplierIcDph || null,
      supplier_address: [parsed.supplierStreet, parsed.supplierCity, parsed.supplierZip].filter(Boolean).join(", ") || null,
      customer_name: parsed.customerName,
      customer_ico: parsed.customerIco || null,
      customer_ic_dph: parsed.customerIcDph || null,
      customer_address: [parsed.customerStreet, parsed.customerCity, parsed.customerZip].filter(Boolean).join(", ") || null,
      issue_date: parsed.issueDate,
      due_date: parsed.dueDate || parsed.issueDate,
      payment_method: parsed.iban ? "bank_transfer" : "cash",
      bank_iban: parsed.iban || null,
      variable_symbol: parsed.variableSymbol || null,
      currency: parsed.currency || "EUR",
      notes: parsed.notes || null,
      contact_id: contactId,
      subtotal: Math.round((parsed.totalAmount - parsed.vatAmount) * 100) / 100,
      vat_amount: Math.round(parsed.vatAmount * 100) / 100,
      total: Math.round(parsed.totalAmount * 100) / 100,
      created_by: user.id,
    })
    .select("id")
    .single()

  if (invoiceError || !invoice) return { error: invoiceError?.message || "Failed to create invoice" }

  // 4. Create invoice items
  if (parsed.items.length > 0) {
    const itemRows = parsed.items.map((item, i) => ({
      invoice_id: invoice.id,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit || "ks",
      unit_price: item.unitPrice,
      vat_rate: item.vatRate,
      vat_amount: Math.round(item.vatAmount * 100) / 100,
      total: Math.round(item.totalPrice * 100) / 100,
      sort_order: i,
    }))
    await supabase.from("invoice_items").insert(itemRows)
  }

  // 5. Audit log
  await supabase.from("audit_logs").insert({
    organization_id: orgId,
    user_id: user.id,
    action: "EINVOICE_IMPORTED",
    entity_type: "invoice",
    entity_id: invoice.id,
    new_data: { source_format: isUbl ? "UBL" : "CII", invoice_number: parsed.invoiceNumber },
  })

  return { invoiceId: invoice.id }
}
