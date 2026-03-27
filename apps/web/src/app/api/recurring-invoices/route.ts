/**
 * GET  /api/recurring-invoices — list recurring invoice templates
 * POST /api/recurring-invoices — create a new template
 *
 * GET query params:
 *   organization_id — required
 *   active_only     — optional: "true"
 *
 * POST body: { organization_id, template_name, customer_name, frequency, next_run_at, items, ... }
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createTemplate, listTemplates } from "@/features/invoices/recurring.service"
import { writeAuditLog } from "@/shared/services/audit.server"

const ItemSchema = z.object({
  description: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().default("ks"),
  unit_price_net: z.number().min(0),
  vat_rate: z.number().min(0).max(100),
})

const CreateTemplateSchema = z.object({
  organization_id: z.string().uuid(),
  template_name: z.string().min(1).max(200),
  customer_name: z.string().min(1),
  customer_ico: z.string().optional(),
  customer_dic: z.string().optional(),
  customer_ic_dph: z.string().optional(),
  customer_address: z.string().optional(),
  customer_email: z.string().email().optional(),
  payment_method: z.string().default("bank_transfer"),
  currency: z.string().default("EUR"),
  notes: z.string().optional(),
  frequency: z.enum(["weekly", "monthly", "quarterly", "yearly"]),
  interval_count: z.number().int().min(1).default(1),
  day_of_month: z.number().int().min(1).max(28).optional(),
  next_run_at: z.string(),
  end_date: z.string().optional(),
  items: z.array(ItemSchema).min(1, "At least one item is required"),
  auto_send: z.boolean().default(false),
  send_to_email: z.string().email().optional(),
})

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const organizationId = url.searchParams.get("organization_id")
    if (!organizationId) {
      return NextResponse.json({ error: "organization_id is required" }, { status: 400 })
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const data = await listTemplates(
      supabase,
      organizationId,
      url.searchParams.get("active_only") === "true"
    )

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const parsed = CreateTemplateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { organization_id, ...fields } = parsed.data

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const template = await createTemplate(supabase, organization_id, user.id, {
      templateName: fields.template_name,
      customerName: fields.customer_name,
      customerIco: fields.customer_ico,
      customerDic: fields.customer_dic,
      customerIcDph: fields.customer_ic_dph,
      customerAddress: fields.customer_address,
      customerEmail: fields.customer_email,
      paymentMethod: fields.payment_method,
      currency: fields.currency,
      notes: fields.notes,
      frequency: fields.frequency,
      intervalCount: fields.interval_count,
      dayOfMonth: fields.day_of_month,
      nextRunAt: fields.next_run_at,
      endDate: fields.end_date,
      items: fields.items,
      autoSend: fields.auto_send,
      sendToEmail: fields.send_to_email,
    })

    if (!template) {
      return NextResponse.json({ error: "Failed to create template" }, { status: 500 })
    }

    await writeAuditLog(supabase, {
      organizationId: organization_id,
      userId: user.id,
      action: "RECURRING_INVOICE_CREATED",
      entityType: "recurring_invoice",
      entityId: template.id,
      newData: { template_name: fields.template_name, frequency: fields.frequency },
    })

    return NextResponse.json({ data: template }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
