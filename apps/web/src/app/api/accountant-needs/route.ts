/**
 * GET /api/accountant-needs — what the accountant needs from this client
 *
 * Query params:
 *   organization_id — required
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAccountantNeeds } from "@/features/reports/dashboard/accountant-needs"
import { verifyOrgMembership, forbiddenResponse } from "@/shared/lib/api-utils"

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

    const membership = await verifyOrgMembership(supabase, user.id, organizationId)
    if (!membership) return forbiddenResponse()

    const needs = await getAccountantNeeds(supabase, organizationId)
    return NextResponse.json({ data: needs })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
