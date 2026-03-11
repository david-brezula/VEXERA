"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { calculateVatAmount, calculateGrossAmount } from "@vexera/utils"
import type { InvoiceFormValues } from "@/lib/validations/invoice.schema"
import type { InvoiceStatus, InvoiceType } from "@vexera/types"

// ─── Private helpers ──────────────────────────────────────────────────────────

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

async function generateInvoiceNumber(
  supabase: SupabaseClient,
  orgId: string,
  type: InvoiceType
): Promise<string> {
  const year = new Date().getFullYear()
  const { data } = await supabase
    .from("invoices")
    .select("invoice_number")
    .eq("organization_id", orgId)
    .eq("invoice_type", type)
    .like("invoice_number", `${year}-%`)
    .order("invoice_number", { ascending: false })
    .limit(1)

  const last = data?.[0]?.invoice_number
  const lastNum = last ? parseInt(last.split("-")[1] ?? "0", 10) : 0
  return `${year}-${String(lastNum + 1).padStart(3, "0")}`
}

function buildItemsPayload(
  invoiceId: string,
  items: InvoiceFormValues["items"]
) {
  return items.map((item, i) => {
    const net = item.quantity * item.unit_price_net
    const vatAmt = calculateVatAmount(net, item.vat_rate)
    const gross = calculateGrossAmount(net, item.vat_rate)
    return {
      invoice_id: invoiceId,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit || "ks",
      unit_price: item.unit_price_net,
      vat_rate: item.vat_rate,
      vat_amount: Math.round(vatAmt * 100) / 100,
      total: Math.round(gross * 100) / 100,
      sort_order: i,
    }
  })
}

// ─── createInvoiceAction ──────────────────────────────────────────────────────

export async function createInvoiceAction(
  values: InvoiceFormValues
): Promise<{ id?: string; error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const invoice_number =
      values.invoice_number ||
      (await generateInvoiceNumber(supabase, orgId, values.invoice_type))

    const subtotal = values.items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price_net,
      0
    )
    const vat_amount = values.items.reduce(
      (sum, item) =>
        sum + calculateVatAmount(item.quantity * item.unit_price_net, item.vat_rate),
      0
    )
    const total = subtotal + vat_amount

    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .insert({
        organization_id: orgId,
        invoice_number,
        invoice_type: values.invoice_type,
        status: "draft",
        supplier_name: values.supplier_name,
        supplier_ico: values.supplier_ico || null,
        supplier_dic: values.supplier_dic || null,
        supplier_ic_dph: values.supplier_ic_dph || null,
        supplier_address: values.supplier_address || null,
        supplier_iban: values.supplier_iban || null,
        customer_name: values.customer_name,
        customer_ico: values.customer_ico || null,
        customer_dic: values.customer_dic || null,
        customer_ic_dph: values.customer_ic_dph || null,
        customer_address: values.customer_address || null,
        issue_date: values.issue_date,
        delivery_date: values.delivery_date || null,
        due_date: values.due_date,
        payment_method: values.payment_method,
        bank_iban: values.bank_iban || null,
        variable_symbol: values.variable_symbol || null,
        constant_symbol: values.constant_symbol || null,
        specific_symbol: values.specific_symbol || null,
        notes: values.notes || null,
        internal_notes: values.internal_notes || null,
        currency: values.currency,
        subtotal: Math.round(subtotal * 100) / 100,
        vat_amount: Math.round(vat_amount * 100) / 100,
        total: Math.round(total * 100) / 100,
        created_by: user.id,
      })
      .select("id")
      .single()

    if (invoiceError) return { error: invoiceError.message }

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(buildItemsPayload(invoice.id, values.items))
    if (itemsError) return { error: itemsError.message }

    await supabase.from("audit_logs").insert({
      organization_id: orgId,
      user_id: user.id,
      action: "INVOICE_CREATED",
      entity_type: "invoice",
      entity_id: invoice.id,
      new_data: { invoice_number, status: "draft", total },
    })

    revalidatePath("/invoices")
    revalidatePath("/")
    return { id: invoice.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── updateInvoiceAction ──────────────────────────────────────────────────────

export async function updateInvoiceAction(
  invoiceId: string,
  values: InvoiceFormValues
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const subtotal = values.items.reduce(
      (sum, item) => sum + item.quantity * item.unit_price_net,
      0
    )
    const vat_amount = values.items.reduce(
      (sum, item) =>
        sum + calculateVatAmount(item.quantity * item.unit_price_net, item.vat_rate),
      0
    )
    const total = subtotal + vat_amount

    const { error: invoiceError } = await supabase
      .from("invoices")
      .update({
        invoice_number: values.invoice_number,
        supplier_name: values.supplier_name,
        supplier_ico: values.supplier_ico || null,
        supplier_dic: values.supplier_dic || null,
        supplier_ic_dph: values.supplier_ic_dph || null,
        supplier_address: values.supplier_address || null,
        supplier_iban: values.supplier_iban || null,
        customer_name: values.customer_name,
        customer_ico: values.customer_ico || null,
        customer_dic: values.customer_dic || null,
        customer_ic_dph: values.customer_ic_dph || null,
        customer_address: values.customer_address || null,
        issue_date: values.issue_date,
        delivery_date: values.delivery_date || null,
        due_date: values.due_date,
        payment_method: values.payment_method,
        bank_iban: values.bank_iban || null,
        variable_symbol: values.variable_symbol || null,
        constant_symbol: values.constant_symbol || null,
        specific_symbol: values.specific_symbol || null,
        notes: values.notes || null,
        internal_notes: values.internal_notes || null,
        currency: values.currency,
        subtotal: Math.round(subtotal * 100) / 100,
        vat_amount: Math.round(vat_amount * 100) / 100,
        total: Math.round(total * 100) / 100,
        updated_by: user.id,
      })
      .eq("id", invoiceId)
      .eq("organization_id", orgId)

    if (invoiceError) return { error: invoiceError.message }

    await supabase.from("invoice_items").delete().eq("invoice_id", invoiceId)

    const { error: itemsError } = await supabase
      .from("invoice_items")
      .insert(buildItemsPayload(invoiceId, values.items))
    if (itemsError) return { error: itemsError.message }

    await supabase.from("audit_logs").insert({
      organization_id: orgId,
      user_id: user.id,
      action: "INVOICE_UPDATED",
      entity_type: "invoice",
      entity_id: invoiceId,
      new_data: { total },
    })

    revalidatePath("/invoices")
    revalidatePath(`/invoices/${invoiceId}`)
    revalidatePath("/")
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── updateInvoiceStatusAction ────────────────────────────────────────────────

export async function updateInvoiceStatusAction(
  invoiceId: string,
  status: InvoiceStatus
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const update: Record<string, unknown> = { status, updated_by: user.id }
    if (status === "paid") update.paid_at = new Date().toISOString()

    const { error } = await supabase
      .from("invoices")
      .update(update)
      .eq("id", invoiceId)
      .eq("organization_id", orgId)

    if (error) return { error: error.message }

    await supabase.from("audit_logs").insert({
      organization_id: orgId,
      user_id: user.id,
      action: "INVOICE_STATUS_CHANGED",
      entity_type: "invoice",
      entity_id: invoiceId,
      new_data: { status },
    })

    revalidatePath("/invoices")
    revalidatePath(`/invoices/${invoiceId}`)
    revalidatePath("/")
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── deleteInvoiceAction ──────────────────────────────────────────────────────

export async function deleteInvoiceAction(
  invoiceId: string
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const { error } = await supabase
      .from("invoices")
      .update({ deleted_at: new Date().toISOString(), updated_by: user.id })
      .eq("id", invoiceId)
      .eq("organization_id", orgId)

    if (error) return { error: error.message }

    await supabase.from("audit_logs").insert({
      organization_id: orgId,
      user_id: user.id,
      action: "INVOICE_DELETED",
      entity_type: "invoice",
      entity_id: invoiceId,
    })

    revalidatePath("/invoices")
    revalidatePath("/")
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}
