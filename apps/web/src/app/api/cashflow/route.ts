/**
 * GET /api/cashflow — cash flow forecast + recurring patterns
 *
 * Query params:
 *   organization_id — required
 *   days            — forecast horizon, default 90
 *
 * Returns:
 *   { summary, forecast: CashFlowForecastPoint[], patterns: RecurringPattern[] }
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  getCashFlowSummary,
  forecast,
  detectRecurringPatterns,
} from "@/lib/services/cashflow.service"

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const organizationId = url.searchParams.get("organization_id")
    if (!organizationId) {
      return NextResponse.json(
        { error: "organization_id is required" },
        { status: 400 },
      )
    }

    // Org membership guard
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const days = parseInt(url.searchParams.get("days") ?? "90", 10)
    const clampedDays = Math.min(Math.max(days, 1), 365)

    // Run pattern detection, then forecast + summary in parallel
    const patterns = await detectRecurringPatterns(supabase, organizationId)
    const [summary, forecastPoints] = await Promise.all([
      getCashFlowSummary(supabase, organizationId),
      forecast(supabase, organizationId, clampedDays),
    ])

    return NextResponse.json({
      summary,
      forecast: forecastPoints,
      patterns,
    })
  } catch (err) {
    console.error("GET /api/cashflow error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    )
  }
}
