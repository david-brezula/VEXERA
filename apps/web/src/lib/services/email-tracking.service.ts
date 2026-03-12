/**
 * Email Tracking Service
 *
 * Tracks whether invoice emails are opened using a 1x1 tracking pixel.
 *
 * Flow:
 *   1. When an invoice email is sent, createTracking() inserts a record
 *      and returns a tracking_pixel_id.
 *   2. The tracking pixel URL is embedded in the email HTML.
 *   3. When the recipient opens the email, the pixel endpoint calls
 *      recordOpen() which updates the record.
 *
 * Usage:
 *   const tracking = await createTracking(supabase, orgId, invoiceId, email, subject)
 *   // Later, when pixel is loaded:
 *   await recordOpen(supabase, pixelId)
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export interface EmailTrackingRecord {
  id: string
  organization_id: string
  invoice_id: string | null
  recipient_email: string
  subject: string | null
  tracking_pixel_id: string
  status: "pending" | "sent" | "delivered" | "opened" | "failed"
  sent_at: string | null
  delivered_at: string | null
  opened_at: string | null
  open_count: number
  created_at: string
}

/**
 * Create a tracking record for an email about to be sent.
 * Returns the tracking_pixel_id to embed in the email.
 */
export async function createTracking(
  supabase: SupabaseClient,
  organizationId: string,
  invoiceId: string | null,
  recipientEmail: string,
  subject: string
): Promise<{ trackingPixelId: string; trackingId: string } | null> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("email_tracking" as any) as any)
    .insert({
      organization_id: organizationId,
      invoice_id: invoiceId,
      recipient_email: recipientEmail,
      subject,
      status: "sent",
      sent_at: new Date().toISOString(),
    })
    .select("id, tracking_pixel_id")
    .single()

  if (error || !data) {
    console.error("[email-tracking] Failed to create tracking:", error?.message)
    return null
  }

  const record = data as { id: string; tracking_pixel_id: string }
  return {
    trackingId: record.id,
    trackingPixelId: record.tracking_pixel_id,
  }
}

/**
 * Generate the tracking pixel URL for embedding in emails.
 */
export function getTrackingPixelUrl(pixelId: string, baseUrl?: string): string {
  const base = baseUrl ?? process.env.NEXT_PUBLIC_APP_URL ?? ""
  return `${base}/api/email/track/${pixelId}`
}

/**
 * Generate the HTML img tag for the tracking pixel.
 */
export function getTrackingPixelHtml(pixelId: string, baseUrl?: string): string {
  const url = getTrackingPixelUrl(pixelId, baseUrl)
  return `<img src="${url}" width="1" height="1" style="display:none" alt="" />`
}

/**
 * Record an email open event. Called when the tracking pixel is loaded.
 * This is called without authentication (from any email client).
 */
export async function recordOpen(
  supabase: SupabaseClient,
  trackingPixelId: string
): Promise<boolean> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: existing, error: fetchErr } = await (supabase.from("email_tracking" as any) as any)
    .select("id, open_count, status")
    .eq("tracking_pixel_id", trackingPixelId)
    .single()

  if (fetchErr || !existing) return false

  const record = existing as { id: string; open_count: number; status: string }
  const isFirstOpen = record.status !== "opened"

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error: updateErr } = await (supabase.from("email_tracking" as any) as any)
    .update({
      status: "opened",
      open_count: record.open_count + 1,
      ...(isFirstOpen ? { opened_at: new Date().toISOString() } : {}),
    })
    .eq("id", record.id)

  if (updateErr) {
    console.error("[email-tracking] Failed to record open:", updateErr.message)
    return false
  }

  return true
}

/**
 * Get tracking records for an invoice.
 */
export async function getTrackingForInvoice(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<EmailTrackingRecord[]> {
  const { data, error } = await supabase
    .from("email_tracking")
    .select("*")
    .eq("invoice_id", invoiceId)
    .order("created_at", { ascending: false })

  if (error) return []
  return (data ?? []) as unknown as EmailTrackingRecord[]
}

/**
 * Get tracking records for an organization.
 */
export async function listTracking(
  supabase: SupabaseClient,
  organizationId: string,
  limit: number = 50
): Promise<EmailTrackingRecord[]> {
  const { data, error } = await supabase
    .from("email_tracking")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) return []
  return (data ?? []) as unknown as EmailTrackingRecord[]
}
