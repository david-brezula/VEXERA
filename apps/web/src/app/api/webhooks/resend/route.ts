/**
 * POST /api/webhooks/resend — Resend webhook endpoint
 *
 * Receives delivery status events from Resend and updates the
 * corresponding email_tracking record.
 *
 * No authentication required — called from Resend servers.
 * Uses service-role client to bypass RLS.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

const STATUS_PRIORITY: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  failed: -1,
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const { type, data } = body as { type?: string; data?: Record<string, unknown> }

  if (!type || !data) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 })
  }

  const resendId = data.email_id as string | undefined
  if (!resendId) {
    return NextResponse.json({ received: true })
  }

  // Use service-role client to bypass RLS — this endpoint has no auth
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error("[resend-webhook] Missing Supabase env vars")
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  // Find tracking record by resend_id
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: tracking } = await (supabase.from("email_tracking" as any) as any)
    .select("id, status")
    .eq("resend_id", resendId)
    .single()

  if (!tracking) {
    // No matching record — might be for a non-tracked email
    return NextResponse.json({ received: true })
  }

  // Map Resend event to status update
  const updates: Record<string, unknown> = {}

  switch (type) {
    case "email.sent":
      updates.status = "sent"
      updates.sent_at = new Date().toISOString()
      break
    case "email.delivered":
      updates.status = "delivered"
      updates.delivered_at = new Date().toISOString()
      break
    case "email.bounced":
    case "email.delivery_delayed":
    case "email.complained":
      updates.status = "failed"
      break
    default:
      // Unknown event type — ignore
      return NextResponse.json({ received: true })
  }

  // Don't downgrade status (e.g., don't overwrite "opened" with "delivered")
  // "failed" always wins regardless of current status
  const currentPriority = STATUS_PRIORITY[tracking.status as string] ?? 0
  const newPriority = STATUS_PRIORITY[updates.status as string] ?? 0

  if (newPriority > currentPriority || updates.status === "failed") {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from("email_tracking" as any) as any)
      .update(updates)
      .eq("id", tracking.id)
  }

  return NextResponse.json({ received: true })
}
