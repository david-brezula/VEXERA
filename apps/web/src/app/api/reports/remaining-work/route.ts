/**
 * GET /api/reports/remaining-work — remaining work report for accountants
 *
 * Query params:
 *   organization_ids — required, comma-separated org UUIDs
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateRemainingWork } from "@/features/reports/services/remaining-work.service"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const orgIdsParam = url.searchParams.get("organization_ids")
    if (!orgIdsParam) {
      return NextResponse.json({ error: "organization_ids is required" }, { status: 400 })
    }

    const organizationIds = orgIdsParam.split(",").map((id) => id.trim()).filter(Boolean)
    if (organizationIds.length === 0) {
      return NextResponse.json({ error: "At least one organization_id is required" }, { status: 400 })
    }

    const report = await generateRemainingWork(supabase, organizationIds)
    return NextResponse.json({ data: report })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
