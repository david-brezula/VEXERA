"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: invoiceError } = await (supabase.from("invoices" as any) as any)
    .insert({
      id: invoiceId,
      organization_id: orgId,
      invoice_type: "received",
      status: "draft",
      customer_name: input.supplierName,
      invoice_number: input.documentNumber,
      issue_date: input.issueDate ?? new Date().toISOString().split("T")[0],
      due_date: input.dueDate,
      total_amount: input.totalAmount,
      vat_amount: input.vatAmount,
      currency: input.currency ?? "EUR",
      variable_symbol: input.variableSymbol,
      bank_iban: input.iban,
    })

  if (invoiceError) return { error: invoiceError.message }

  // Link document to invoice
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await (supabase.from("documents" as any) as any)
    .update({ invoice_id: invoiceId })
    .eq("id", input.documentId)

  // Create a single line item
  if (input.totalAmount) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("invoice_items" as any) as any)
      .insert({
        invoice_id: invoiceId,
        description: "Imported from OCR",
        quantity: 1,
        unit: "ks",
        unit_price: totalNet,
        vat_rate: input.vatRate ?? 20,
        total_price: input.totalAmount,
        sort_order: 0,
      })
  }

  revalidatePath("/invoices")
  revalidatePath("/documents")
  return { invoiceId }
}
