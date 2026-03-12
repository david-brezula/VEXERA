/**
 * GET /api/reports/category — generate category breakdown report
 *
 * Query params:
 *   organization_id — required
 *   from            — required (YYYY-MM-DD)
 *   to              — required (YYYY-MM-DD)
 *   currency        — optional (default EUR)
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { generateCategoryReport } from "@/lib/services/reports/category-report.service"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const organizationId = url.searchParams.get("organization_id")
    const from = url.searchParams.get("from")
    const to = url.searchParams.get("to")
    const currency = url.searchParams.get("currency") ?? "EUR"

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

    const report = await generateCategoryReport(supabase, organizationId, { from, to }, currency)

    return NextResponse.json({ data: report })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
