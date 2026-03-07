/**
 * GET /api/documents/[id]/duplicates — find duplicate candidates for a document
 *
 * Query params:
 *   organization_id — required UUID
 *
 * Returns:
 *   { data: DuplicateCandidate[] }
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { findDuplicates } from "@/lib/services/duplicate-detection.service"

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: documentId } = await params

    const url = new URL(request.url)
    const organizationId = url.searchParams.get("organization_id")
    if (!organizationId) {
      return NextResponse.json({ error: "organization_id is required" }, { status: 400 })
    }

    // Service-layer org guard (RLS is additional protection)
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const duplicates = await findDuplicates(supabase, organizationId, documentId)

    return NextResponse.json({ data: duplicates })
  } catch (err) {
    console.error("GET /api/documents/[id]/duplicates error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
