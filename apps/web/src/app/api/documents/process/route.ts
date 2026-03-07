/**
 * POST /api/documents/process — batch process all queued OCR documents
 *
 * Finds all documents with ocr_status='queued' for the user's organization
 * and processes them sequentially through Google Cloud Vision OCR.
 *
 * Request body:
 *   { organization_id: string }
 *
 * Returns summary of processed/failed counts.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { processAllQueued } from "@/lib/services/ocr.service"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json().catch(() => ({}))
    const organizationId = body.organization_id as string | undefined

    if (!organizationId) {
      return NextResponse.json(
        { error: "organization_id is required" },
        { status: 400 }
      )
    }

    // Verify user is a member of the organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Process all queued documents
    const result = await processAllQueued(supabase, organizationId)

    return NextResponse.json({
      status: "completed",
      processed: result.processed,
      failed: result.failed,
      total: result.total,
      message: `Processed ${result.processed}/${result.total} documents (${result.failed} failed)`,
    })
  } catch (err) {
    console.error("POST /api/documents/process error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
