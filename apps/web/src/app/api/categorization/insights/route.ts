/**
 * GET /api/categorization/insights — correction insights for category learning
 *
 * Query params:
 *   organization_id — required
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getCorrectionInsights } from "@/lib/services/categorization.service"

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

    const insights = await getCorrectionInsights(supabase, organizationId)
    return NextResponse.json({ data: insights })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
