"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"
import { revalidatePath } from "next/cache"

interface OcrInvoiceInput {
  documentId: string
  supplierName: string
  documentNumber: string | null
  issueDate: string | null
  dueDate: string | null
  totalAmount: number | null
  vatAmount: number | null
  vatRate: number | null
  currency: string | null
  iban: string | null
  variableSymbol: string | null
}

export async function createInvoiceFromOcrAction(
  input: OcrInvoiceInput
): Promise<{ invoiceId?: string; error?: string }> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const invoiceId = crypto.randomUUID()
  const totalNet = input.totalAmount && input.vatAmount
    ? input.totalAmount - input.vatAmount
    : input.totalAmount ?? 0

  const { error: invoiceError } = await supabase.from("invoices")
    .insert({
      id: invoiceId,
      organization_id: orgId,
      invoice_type: "received",
      status: "draft",
      supplier_name: input.supplierName ?? "Unknown",
      customer_name: "",
      invoice_number: input.documentNumber ?? `OCR-${Date.now()}`,
      issue_date: input.issueDate ?? new Date().toISOString().split("T")[0],
      due_date: input.dueDate ?? new Date().toISOString().split("T")[0],
      subtotal: totalNet,
      vat_amount: input.vatAmount ?? 0,
      total: input.totalAmount ?? 0,
      currency: input.currency ?? "EUR",
      variable_symbol: input.variableSymbol,
      bank_iban: input.iban,
    })

  if (invoiceError) return { error: invoiceError.message }

  // Link document to invoice
  await supabase.from("documents")
    .update({ invoice_id: invoiceId })
    .eq("id", input.documentId)

  // Create a single line item
  if (input.totalAmount) {
    await supabase.from("invoice_items")
      .insert({
        invoice_id: invoiceId,
        description: "Imported from OCR",
        quantity: 1,
        unit: "ks",
        unit_price: totalNet,
        vat_rate: input.vatRate ?? 20,
        vat_amount: input.vatAmount ?? 0,
        total: input.totalAmount,
        sort_order: 0,
      })
  }

  revalidatePath("/invoices")
  revalidatePath("/documents")
  return { invoiceId }
}
