"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { calculateVatAmount, calculateGrossAmount } from "@vexera/utils"
import type { InvoiceFormValues } from "@/lib/validations/invoice.schema"
import type { InvoiceStatus, InvoiceType } from "@vexera/types"
import { postInvoiceToLedger } from "./invoice-posting"

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
      product_id: (item as any).product_id || null,
    }
  })
}

async function updateContactStats(
  supabase: SupabaseClient,
  contactId: string,
  invoiceTotal: number
) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: contact } = await (supabase.from("contacts" as any) as any)
      .select("invoice_count, total_invoiced")
      .eq("id", contactId)
      .single()

    if (!contact) return

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("contacts" as any) as any)
      .update({
        invoice_count: (contact.invoice_count ?? 0) + 1,
        total_invoiced: Math.round(
          (Number(contact.total_invoiced ?? 0) + Math.abs(invoiceTotal)) * 100
        ) / 100,
      })
      .eq("id", contactId)
  } catch (err) {
    console.error("[updateContactStats] Failed:", err)
  }
}

async function updateProductStats(
  supabase: SupabaseClient,
  items: Array<{ product_id?: string; quantity: number; unit_price_net: number }>
) {
  try {
    const productTotals = new Map<string, number>()
    const productCounts = new Map<string, number>()
    for (const item of items) {
      const pid = (item as any).product_id
      if (!pid) continue
      const itemTotal = item.quantity * item.unit_price_net
      productTotals.set(pid, (productTotals.get(pid) ?? 0) + itemTotal)
      productCounts.set(pid, (productCounts.get(pid) ?? 0) + 1)
    }

    for (const [productId, revenue] of productTotals) {
      const count = productCounts.get(productId) ?? 1
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: product } = await (supabase.from("products" as any) as any)
        .select("times_invoiced, total_revenue")
        .eq("id", productId)
        .single()

      if (!product) continue

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (supabase.from("products" as any) as any)
        .update({
          times_invoiced: (product.times_invoiced ?? 0) + count,
          total_revenue: Math.round(
            (Number(product.total_revenue ?? 0) + revenue) * 100
          ) / 100,
        })
        .eq("id", productId)
    }
  } catch (err) {
    console.error("[updateProductStats] Failed:", err)
  }
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
        contact_id: (values as any).contact_id || null,
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

    // Auto-create draft journal entry for ledger
    try {
      await postInvoiceToLedger(supabase, orgId, user.id, {
        id: invoice.id,
        invoice_number,
        invoice_type: values.invoice_type,
        issue_date: values.issue_date,
        subtotal: Math.round(subtotal * 100) / 100,
        vat_amount: Math.round(vat_amount * 100) / 100,
        total: Math.round(total * 100) / 100,
      })
    } catch (e) {
      // Don't fail invoice creation if ledger posting fails
      console.error("Failed to create ledger entry for invoice:", e)
    }

    if ((values as any).contact_id) {
      await updateContactStats(supabase, (values as any).contact_id, total)
    }
    await updateProductStats(supabase, values.items)

    revalidatePath("/invoices")
    revalidatePath("/ledger")
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
        contact_id: (values as any).contact_id || null,
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

// ─── createCreditNoteAction ──────────────────────────────────────────────────

export async function createCreditNoteAction(
  originalInvoiceId: string
): Promise<{ id?: string; error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const { data: original, error: fetchError } = await supabase
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("id", originalInvoiceId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .single()

    if (fetchError || !original) return { error: "Original invoice not found" }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const orig = original as any

    if (!["sent", "paid"].includes(orig.status)) {
      return { error: "Credit notes can only be created for sent or paid invoices" }
    }

    const invoice_number = await generateInvoiceNumber(supabase, orgId, "credit_note" as InvoiceType)

    const subtotal = -Math.abs(Number(orig.subtotal))
    const vat_amount = -Math.abs(Number(orig.vat_amount))
    const total = -Math.abs(Number(orig.total))

    const { data: creditNote, error: insertError } = await supabase
      .from("invoices")
      .insert({
        organization_id: orgId,
        invoice_number,
        invoice_type: "credit_note",
        status: "draft",
        credit_note_for_id: originalInvoiceId,
        supplier_name: orig.supplier_name,
        supplier_ico: orig.supplier_ico,
        supplier_dic: orig.supplier_dic,
        supplier_ic_dph: orig.supplier_ic_dph,
        supplier_address: orig.supplier_address,
        supplier_iban: orig.supplier_iban,
        customer_name: orig.customer_name,
        customer_ico: orig.customer_ico,
        customer_dic: orig.customer_dic,
        customer_ic_dph: orig.customer_ic_dph,
        customer_address: orig.customer_address,
        issue_date: new Date().toISOString().slice(0, 10),
        delivery_date: new Date().toISOString().slice(0, 10),
        due_date: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
        payment_method: orig.payment_method,
        bank_iban: orig.bank_iban,
        variable_symbol: orig.variable_symbol,
        constant_symbol: orig.constant_symbol,
        specific_symbol: orig.specific_symbol,
        notes: `Credit note for invoice ${orig.invoice_number}`,
        currency: orig.currency,
        subtotal: Math.round(subtotal * 100) / 100,
        vat_amount: Math.round(vat_amount * 100) / 100,
        total: Math.round(total * 100) / 100,
        created_by: user.id,
      })
      .select("id")
      .single()

    if (insertError) return { error: insertError.message }

    const originalItems = orig.invoice_items ?? []
    if (originalItems.length > 0) {
      const creditItems = originalItems.map((item: any, i: number) => ({
        invoice_id: creditNote.id,
        description: item.description,
        quantity: item.quantity,
        unit: item.unit || "ks",
        unit_price: -Math.abs(Number(item.unit_price)),
        vat_rate: item.vat_rate,
        vat_amount: -Math.abs(Number(item.vat_amount)),
        total: -Math.abs(Number(item.total)),
        sort_order: i,
      }))

      const { error: itemsError } = await supabase
        .from("invoice_items")
        .insert(creditItems)
      if (itemsError) return { error: itemsError.message }
    }

    await supabase.from("audit_logs").insert({
      organization_id: orgId,
      user_id: user.id,
      action: "CREDIT_NOTE_CREATED",
      entity_type: "invoice",
      entity_id: creditNote.id,
      new_data: { invoice_number, original_invoice_id: originalInvoiceId },
    })

    revalidatePath("/invoices")
    revalidatePath(`/invoices/${originalInvoiceId}`)
    revalidatePath("/")
    return { id: creditNote.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── sendInvoiceEmailAction ──────────────────────────────────────────────────

export async function sendInvoiceEmailAction(
  invoiceId: string,
  recipientEmail: string
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const { data: invoice, error: fetchError } = await supabase
      .from("invoices")
      .select("id, invoice_number, status")
      .eq("id", invoiceId)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .single()

    if (fetchError || !invoice) return { error: "Invoice not found" }

    // TODO: Generate PDF and send via transactional email service (Resend/Postmark)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("email_tracking" as any) as any).insert({
      organization_id: orgId,
      invoice_id: invoiceId,
      recipient_email: recipientEmail,
      subject: `Invoice ${invoice.invoice_number}`,
      status: "pending",
    })

    await supabase.from("audit_logs").insert({
      organization_id: orgId,
      user_id: user.id,
      action: "INVOICE_EMAIL_QUEUED",
      entity_type: "invoice",
      entity_id: invoiceId,
      new_data: { recipient_email: recipientEmail },
    })

    revalidatePath(`/invoices/${invoiceId}`)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}
