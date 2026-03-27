/**
 * POST /api/webhooks/resend — Resend webhook endpoint
 *
 * Receives delivery status events from Resend and updates the
 * corresponding email_tracking record.
 *
 * Authentication: validates the webhook signing secret from the
 * `resend-signature` header to prevent forged requests.
 * Uses service-role client to bypass RLS.
 */

import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { createHmac, timingSafeEqual } from "crypto"

const STATUS_PRIORITY: Record<string, number> = {
  pending: 0,
  sent: 1,
  delivered: 2,
  opened: 3,
  failed: -1,
}

/** Verify the Resend webhook signature (Svix-based HMAC-SHA256). */
function verifyWebhookSignature(
  payload: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader) return false

  // Resend (via Svix) sends signatures in format: "v1,<base64-sig>"
  // The secret is base64-encoded with a "whsec_" prefix
  const secretBytes = Buffer.from(secret.replace("whsec_", ""), "base64")

  // Extract the message ID and timestamp from Svix headers for verification
  // The signature is computed over: msgId.timestamp.body
  const signatures = signatureHeader.split(" ")
  for (const versionedSig of signatures) {
    const [version, sig] = versionedSig.split(",")
    if (version !== "v1" || !sig) continue

    try {
      const expectedSig = Buffer.from(sig, "base64")
      const computedSig = createHmac("sha256", secretBytes)
        .update(payload)
        .digest()

      if (
        expectedSig.length === computedSig.length &&
        timingSafeEqual(expectedSig, computedSig)
      ) {
        return true
      }
    } catch {
      continue
    }
  }

  return false
}

export async function POST(req: NextRequest) {
  // Verify webhook signature if signing secret is configured
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  let body: Record<string, unknown>

  if (!webhookSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error("[resend-webhook] RESEND_WEBHOOK_SECRET is required in production")
      return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
    }
    console.warn("[resend-webhook] RESEND_WEBHOOK_SECRET not configured — skipping signature verification")
    try {
      body = await req.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
  } else {
    const rawBody = await req.text()
    const signature = req.headers.get("resend-signature")

    if (!verifyWebhookSignature(rawBody, signature, webhookSecret)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 401 })
    }

    try {
      body = JSON.parse(rawBody)
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }
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
  const { data: tracking } = await supabase.from("email_tracking")
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
    await supabase.from("email_tracking")
      .update(updates)
      .eq("id", tracking.id)
  }

  return NextResponse.json({ received: true })
}
