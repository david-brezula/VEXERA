/**
 * GET /api/email/track/[pixelId] — tracking pixel endpoint
 *
 * Returns a transparent 1x1 PNG and records the email open.
 * No authentication required — called from any email client.
 */

import { createClient } from "@supabase/supabase-js"
import { recordOpen } from "@/lib/services/email-tracking.service"

// 1x1 transparent PNG (base64)
const TRANSPARENT_PIXEL = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64"
)

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ pixelId: string }> }
) {
  const { pixelId } = await params

  // Use service role client to bypass RLS — this endpoint has no auth
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (supabaseUrl && supabaseServiceKey) {
    try {
      const supabase = createClient(supabaseUrl, supabaseServiceKey)
      await recordOpen(supabase, pixelId)
    } catch (err) {
      console.error("[email-track] Error recording open:", err)
    }
  }

  return new Response(TRANSPARENT_PIXEL, {
    status: 200,
    headers: {
      "Content-Type": "image/png",
      "Content-Length": String(TRANSPARENT_PIXEL.length),
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  })
}
