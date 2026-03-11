/**
 * GET  /api/payments — list payments for an invoice
 * POST /api/payments — record a new payment
 *
 * Query params (GET):
 *   invoice_id — required
 *
 * Body (POST):
 *   organization_id, invoice_id, amount, + optional fields
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { recordPayment, getPaymentHistory } from "@/lib/services/payment.service"
import { writeAuditLog } from "@/lib/services/audit.server"

const createSchema = z.object({
  organization_id: z.string().uuid(),
  invoice_id: z.string().uuid(),
  amount: z.number().positive(),
  currency: z.string().default("EUR"),
  payment_date: z.string().optional(),
  payment_method: z.enum(["bank_transfer", "cash", "card", "other"]).default("bank_transfer"),
  reference: z.string().optional(),
  bank_transaction_id: z.string().uuid().optional(),
  notes: z.string().optional(),
})

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const invoiceId = url.searchParams.get("invoice_id")
    if (!invoiceId) {
      return NextResponse.json({ error: "invoice_id is required" }, { status: 400 })
    }

    const payments = await getPaymentHistory(supabase, invoiceId)
    return NextResponse.json({ data: payments })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const { organization_id, invoice_id, ...input } = parsed.data
    const payment = await recordPayment(supabase, organization_id, invoice_id, input)

    await writeAuditLog(supabase, {
      organizationId: organization_id,
      userId: user.id,
      action: "payment.recorded",
      entityType: "invoice",
      entityId: invoice_id,
      newData: { amount: input.amount, payment_id: payment.id },
    })

    return NextResponse.json({ data: payment }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
