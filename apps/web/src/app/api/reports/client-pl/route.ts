/**
 * GET /api/reports/client-pl — generate P&L summary for all client tags
 *
 * Query params:
 *   organization_id — required
 *   from            — required (YYYY-MM-DD)
 *   to              — required (YYYY-MM-DD)
 *   tag_id          — optional (single tag P&L instead of all)
 *   tag_type        — optional: "client" | "project" (default: "client")
 *   refresh         — optional ("true" to skip cache)
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateTagPL, generateAllTagsPLSummary } from "@/lib/services/reports/client-project-pl.service"
import { getCachedOrGenerate } from "@/lib/services/reports/report-cache"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const organizationId = url.searchParams.get("organization_id")
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")
    const tagId = url.searchParams.get("tag_id")
    const tagType = (url.searchParams.get("tag_type") ?? "client") as "client" | "project"
    const refresh = url.searchParams.get("refresh") === "true"

    if (!organizationId || !from || !to) {
      return NextResponse.json(
        { error: "organization_id, from, and to are required" },
        { status: 400 }
      )
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    if (tagId) {
      // Single tag P&L — no caching for individual tag drilldowns
      const report = await generateTagPL(supabase, organizationId, tagId, { from, to })
      return NextResponse.json({ data: report })
    }

    const reportType = tagType === "client" ? "client_pl" : "project_pl" as const

    const result = await getCachedOrGenerate(
      supabase,
      organizationId,
      reportType,
      from,
      to,
      { tag_type: tagType },
      () => generateAllTagsPLSummary(supabase, organizationId, tagType, { from, to }),
      { skipCache: refresh }
    )

    return NextResponse.json({
      data: result.data,
      cached: result.cached,
      generatedAt: result.generatedAt,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
