/**
 * Payment Service
 *
 * Records individual payments against invoices, supporting partial payments
 * and overpayments. Updates invoice paid_amount/remaining_amount and status.
 *
 * Usage:
 *   const payment = await recordPayment(supabase, orgId, invoiceId, { amount: 500 })
 *   const history = await getPaymentHistory(supabase, invoiceId)
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface InvoicePayment {
  id: string
  organization_id: string
  invoice_id: string
  amount: number
  currency: string
  payment_date: string
  payment_method: "bank_transfer" | "cash" | "card" | "other"
  reference: string | null
  bank_transaction_id: string | null
  notes: string | null
  created_at: string
}

export interface RecordPaymentInput {
  amount: number
  currency?: string
  payment_date?: string
  payment_method?: "bank_transfer" | "cash" | "card" | "other"
  reference?: string
  bank_transaction_id?: string
  notes?: string
}

// ─── Record Payment ─────────────────────────────────────────────────────────

/**
 * Record a payment against an invoice.
 * Updates the invoice's paid_amount, remaining_amount, and status.
 */
export async function recordPayment(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string,
  input: RecordPaymentInput
): Promise<InvoicePayment> {
  // Get current invoice state
  const { data: invoice, error: invoiceErr } = await supabase
    .from("invoices")
    .select("total_amount, paid_amount, status")
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .single()

  if (invoiceErr || !invoice) {
    throw new Error("Invoice not found")
  }

  const inv = invoice as { total_amount: number; paid_amount: number; status: string }

  // Insert payment record
  const { data: payment, error: paymentErr } = await supabase.from("invoice_payments")
    .insert({
      organization_id: organizationId,
      invoice_id: invoiceId,
      amount: input.amount,
      currency: input.currency ?? "EUR",
      payment_date: input.payment_date ?? new Date().toISOString().split("T")[0],
      payment_method: input.payment_method ?? "bank_transfer",
      reference: input.reference ?? null,
      bank_transaction_id: input.bank_transaction_id ?? null,
      notes: input.notes ?? null,
    })
    .select("*")
    .single()

  if (paymentErr || !payment) {
    throw new Error(`Failed to record payment: ${paymentErr?.message ?? "unknown error"}`)
  }

  // Update invoice totals
  const newPaidAmount = (inv.paid_amount ?? 0) + input.amount
  const totalAmount = inv.total_amount ?? 0
  const remaining = totalAmount - newPaidAmount

  // Determine new status
  let newStatus = inv.status
  if (remaining <= 0) {
    newStatus = "paid"
  } else if (newPaidAmount > 0) {
    newStatus = "partially_paid"
  }

  await supabase
    .from("invoices")
    .update({
      paid_amount: Number(newPaidAmount.toFixed(2)),
      remaining_amount: Number(remaining.toFixed(2)),
      status: newStatus,
      ...(remaining <= 0 ? { paid_at: new Date().toISOString() } : {}),
    })
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)

  return payment as InvoicePayment
}

// ─── Payment History ────────────────────────────────────────────────────────

/**
 * Get all payments for an invoice.
 */
export async function getPaymentHistory(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<InvoicePayment[]> {
  const { data, error } = await supabase
    .from("invoice_payments")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("payment_date", { ascending: true })

  if (error) return []
  return (data ?? []) as InvoicePayment[]
}

// ─── Overpayment Handling ───────────────────────────────────────────────────

/**
 * Check if an invoice has been overpaid.
 * Returns the overpayment amount (positive) or 0.
 */
export async function checkOverpayment(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string
): Promise<{ overpayment: number; totalPaid: number; invoiceTotal: number }> {
  const { data: invoice } = await supabase
    .from("invoices")
    .select("total_amount, paid_amount")
    .eq("id", invoiceId)
    .eq("organization_id", organizationId)
    .single()

  if (!invoice) return { overpayment: 0, totalPaid: 0, invoiceTotal: 0 }

  const inv = invoice as { total_amount: number; paid_amount: number }
  const overpayment = Math.max(0, (inv.paid_amount ?? 0) - (inv.total_amount ?? 0))

  return {
    overpayment: Number(overpayment.toFixed(2)),
    totalPaid: inv.paid_amount ?? 0,
    invoiceTotal: inv.total_amount ?? 0,
  }
}
