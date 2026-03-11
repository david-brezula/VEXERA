/**
 * GET /api/email/tracking — list tracking records for an invoice
 *
 * Query params:
 *   invoice_id — required
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getTrackingForInvoice } from "@/lib/services/email-tracking.service"

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

    const records = await getTrackingForInvoice(supabase, invoiceId)
    return NextResponse.json({ data: records })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
