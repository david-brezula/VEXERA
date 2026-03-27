/**
 * GET  /api/archive — get retention policies and expiring documents
 * POST /api/archive — initialize default retention policies
 *
 * Query params (GET):
 *   organization_id — required
 *   type — "policies" | "expiring" (default: "policies")
 *   days — days ahead for expiring (default: 30)
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getRetentionPolicies,
  getExpiringDocuments,
  setRetentionPolicies,
} from "@/features/settings/archive.service"
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

    const type = url.searchParams.get("type") ?? "policies"

    if (type === "expiring") {
      const days = parseInt(url.searchParams.get("days") ?? "30", 10)
      const expiring = await getExpiringDocuments(supabase, organizationId, days)
      return NextResponse.json({ data: expiring })
    }

    const policies = await getRetentionPolicies(supabase, organizationId)
    return NextResponse.json({ data: policies })
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
    const organizationId = body.organization_id
    if (!organizationId) {
      return NextResponse.json({ error: "organization_id is required" }, { status: 400 })
    }

    const membership = await verifyOrgMembership(supabase, user.id, organizationId)
    if (!membership) return forbiddenResponse()

    const created = await setRetentionPolicies(supabase, organizationId)
    return NextResponse.json({ data: { created } })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
