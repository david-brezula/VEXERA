/**
 * PATCH /api/archive/[id] — update a retention policy
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { updateRetentionPolicy } from "@/features/settings/archive.service"
import { verifyOrgMembership, forbiddenResponse } from "@/shared/lib/api-utils"

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    const body = await request.json()

    // Get org_id from the policy
    const { data: existing } = await supabase
      .from("archive_policies")
      .select("organization_id")
      .eq("id", id)
      .single()

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const orgId = (existing as unknown as { organization_id: string }).organization_id
    const membership = await verifyOrgMembership(supabase, user.id, orgId)
    if (!membership) return forbiddenResponse()
    const policy = await updateRetentionPolicy(supabase, orgId, id, body)

    return NextResponse.json({ data: policy })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
