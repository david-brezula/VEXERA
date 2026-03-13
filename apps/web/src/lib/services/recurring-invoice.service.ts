/**
 * Recurring Invoice Service
 *
 * Manages templates for auto-generating invoices on a schedule.
 * The processRecurringInvoices() function is called by the queue processor.
 *
 * Usage:
 *   await createTemplate(supabase, orgId, templateData)
 *   await processRecurringInvoices(supabase)  // system-wide job
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import { enqueueJob } from "@/lib/services/queue.service"

// ─── Types ───────────────────────────────────────────────────────────────────

export type Frequency = "weekly" | "monthly" | "quarterly" | "yearly"

export interface TemplateItem {
  description: string
  quantity: number
  unit: string
  unit_price_net: number
  vat_rate: number
}

export interface RecurringInvoiceTemplate {
  id: string
  organization_id: string
  template_name: string
  is_active: boolean
  invoice_type: string
  customer_name: string
  customer_ico: string | null
  customer_dic: string | null
  customer_ic_dph: string | null
  customer_address: string | null
  customer_email: string | null
  payment_method: string
  currency: string
  notes: string | null
  frequency: Frequency
  interval_count: number
  day_of_month: number | null
  next_run_at: string
  last_run_at: string | null
  end_date: string | null
  items: TemplateItem[]
  auto_send: boolean
  send_to_email: string | null
  invoices_generated: number
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface CreateTemplateInput {
  templateName: string
  customerName: string
  customerIco?: string
  customerDic?: string
  customerIcDph?: string
  customerAddress?: string
  customerEmail?: string
  paymentMethod?: string
  currency?: string
  notes?: string
  frequency: Frequency
  intervalCount?: number
  dayOfMonth?: number
  nextRunAt: string
  endDate?: string
  items: TemplateItem[]
  autoSend?: boolean
  sendToEmail?: string
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function createTemplate(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  input: CreateTemplateInput
): Promise<RecurringInvoiceTemplate | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("recurring_invoice_templates" as any) as any)
    .insert({
      organization_id: organizationId,
      template_name: input.templateName,
      customer_name: input.customerName,
      customer_ico: input.customerIco ?? null,
      customer_dic: input.customerDic ?? null,
      customer_ic_dph: input.customerIcDph ?? null,
      customer_address: input.customerAddress ?? null,
      customer_email: input.customerEmail ?? null,
      payment_method: input.paymentMethod ?? "bank_transfer",
      currency: input.currency ?? "EUR",
      notes: input.notes ?? null,
      frequency: input.frequency,
      interval_count: input.intervalCount ?? 1,
      day_of_month: input.dayOfMonth ?? null,
      next_run_at: input.nextRunAt,
      end_date: input.endDate ?? null,
      items: input.items,
      auto_send: input.autoSend ?? false,
      send_to_email: input.sendToEmail ?? null,
      created_by: userId,
    })
    .select("*")
    .single()

  if (error) {
    console.error("[recurring-invoice] Failed to create template:", error.message)
    return null
  }
  return data as RecurringInvoiceTemplate
}

export async function listTemplates(
  supabase: SupabaseClient,
  organizationId: string,
  activeOnly: boolean = false
): Promise<RecurringInvoiceTemplate[]> {
  let query = supabase
    .from("recurring_invoice_templates")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })

  if (activeOnly) query = query.eq("is_active", true)

  const { data, error } = await query

  if (error) {
    console.error("[recurring-invoice] Failed to list templates:", error.message)
    return []
  }
  return (data ?? []) as unknown as RecurringInvoiceTemplate[]
}

export async function updateTemplate(
  supabase: SupabaseClient,
  templateId: string,
  updates: Partial<Record<string, unknown>>
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (supabase.from("recurring_invoice_templates" as any) as any)
    .update(updates)
    .eq("id", templateId)

  if (error) {
    console.error("[recurring-invoice] Failed to update template:", error.message)
    return false
  }
  return true
}

export async function deleteTemplate(
  supabase: SupabaseClient,
  templateId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("recurring_invoice_templates")
    .delete()
    .eq("id", templateId)

  if (error) {
    console.error("[recurring-invoice] Failed to delete template:", error.message)
    return false
  }
  return true
}

// ─── Invoice Generation ──────────────────────────────────────────────────────

/**
 * Generate an invoice from a recurring template.
 * Creates the invoice + invoice_items, advances next_run_at.
 */
export async function generateInvoiceFromTemplate(
  supabase: SupabaseClient,
  template: RecurringInvoiceTemplate
): Promise<string | null> {
  try {
    const today = new Date().toISOString().split("T")[0]

    // Calculate due date (default: 14 days from issue)
    const dueDate = new Date()
    dueDate.setDate(dueDate.getDate() + 14)

    // Calculate totals from items
    let totalNet = 0
    let totalVat = 0
    for (const item of template.items) {
      const lineNet = item.quantity * item.unit_price_net
      const lineVat = lineNet * (item.vat_rate / 100)
      totalNet += lineNet
      totalVat += lineVat
    }
    const totalGross = totalNet + totalVat

    // Create the invoice
    const invoiceId = crypto.randomUUID()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: invoiceError } = await (supabase.from("invoices" as any) as any)
      .insert({
        id: invoiceId,
        organization_id: template.organization_id,
        invoice_type: template.invoice_type,
        status: "draft",
        customer_name: template.customer_name,
        customer_ico: template.customer_ico,
        customer_dic: template.customer_dic,
        customer_ic_dph: template.customer_ic_dph,
        customer_address: template.customer_address,
        payment_method: template.payment_method,
        currency: template.currency,
        issue_date: today,
        due_date: dueDate.toISOString().split("T")[0],
        total_amount: totalGross,
        vat_amount: totalVat,
        notes: template.notes,
        created_by: template.created_by,
      })

    if (invoiceError) {
      console.error("[recurring-invoice] Failed to create invoice:", invoiceError.message)
      return null
    }

    // Create invoice items
    const itemRows = template.items.map((item, index) => ({
      invoice_id: invoiceId,
      description: item.description,
      quantity: item.quantity,
      unit: item.unit,
      unit_price: item.unit_price_net,
      vat_rate: item.vat_rate,
      total_price: item.quantity * item.unit_price_net * (1 + item.vat_rate / 100),
      sort_order: index,
    }))

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("invoice_items" as any) as any).insert(itemRows)

    // Advance next_run_at
    const nextDate = calculateNextRunDate(
      new Date(template.next_run_at),
      template.frequency,
      template.interval_count
    )

    // Check if end_date is reached
    const isExpired = template.end_date && nextDate.toISOString().split("T")[0] > template.end_date

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("recurring_invoice_templates" as any) as any)
      .update({
        last_run_at: today,
        next_run_at: nextDate.toISOString().split("T")[0],
        invoices_generated: template.invoices_generated + 1,
        is_active: !isExpired,
      })
      .eq("id", template.id)

    return invoiceId
  } catch (err) {
    console.error("[recurring-invoice] Error generating invoice:", err)
    return null
  }
}

/**
 * System-wide job: find all due templates and generate invoices.
 */
export async function processRecurringInvoices(
  supabase: SupabaseClient
): Promise<{ generated: number; errors: number }> {
  const today = new Date().toISOString().split("T")[0]

  const { data: templates } = await supabase
    .from("recurring_invoice_templates")
    .select("*")
    .eq("is_active", true)
    .lte("next_run_at", today)

  if (!templates || templates.length === 0) {
    return { generated: 0, errors: 0 }
  }

  let generated = 0
  let errors = 0

  for (const template of templates as unknown as RecurringInvoiceTemplate[]) {
    const invoiceId = await generateInvoiceFromTemplate(supabase, template)
    if (invoiceId) {
      generated++

      // Enqueue auto-send email job if configured
      if (template.auto_send && template.send_to_email) {
        try {
          await enqueueJob(supabase, {
            organizationId: template.organization_id,
            jobType: "recurring_invoice",
            payload: {
              action: "send_email",
              invoiceId,
              recipientEmail: template.send_to_email,
            },
          })
        } catch (err) {
          console.error("[recurring-invoice] Failed to enqueue auto-send job:", err)
          // Don't count as error — invoice was still generated successfully
        }
      }
    } else {
      errors++
    }
  }

  return { generated, errors }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function calculateNextRunDate(
  current: Date,
  frequency: Frequency,
  intervalCount: number
): Date {
  const next = new Date(current)

  switch (frequency) {
    case "weekly":
      next.setDate(next.getDate() + 7 * intervalCount)
      break
    case "monthly":
      next.setMonth(next.getMonth() + intervalCount)
      break
    case "quarterly":
      next.setMonth(next.getMonth() + 3 * intervalCount)
      break
    case "yearly":
      next.setFullYear(next.getFullYear() + intervalCount)
      break
  }

  return next
}
