/**
 * GET  /api/vat — current quarter VAT position + timeline
 * POST /api/vat — recalculate VAT for a specific quarter
 *
 * GET query params:
 *   organization_id — required
 *   year            — optional (defaults to current year)
 *   quarter         — optional (defaults to current quarter)
 *   periods         — timeline length, default 4
 *
 * POST body:
 *   { organization_id: string, year: number, quarter: number }
 *
 * Returns:
 *   GET  → { current: VatReturn, timeline: VatReturn[] }
 *   POST → VatReturn (the recalculated quarter)
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import {
  calculateVatReturn,
  getCurrentQuarterVat,
  getVatTimeline,
} from "@/lib/services/vat.service"

// ─── GET ────────────────────────────────────────────────────────────────────

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

    const yearParam = url.searchParams.get("year")
    const quarterParam = url.searchParams.get("quarter")
    const periods = parseInt(url.searchParams.get("periods") ?? "4", 10)

    let current
    if (yearParam && quarterParam) {
      const year = parseInt(yearParam, 10)
      const quarter = parseInt(quarterParam, 10)
      if (quarter < 1 || quarter > 4 || isNaN(year)) {
        return NextResponse.json(
          { error: "Invalid year or quarter" },
          { status: 400 },
        )
      }
      current = await calculateVatReturn(supabase, organizationId, year, quarter)
    } else {
      current = await getCurrentQuarterVat(supabase, organizationId)
    }

    const timeline = await getVatTimeline(
      supabase,
      organizationId,
      Math.min(Math.max(periods, 1), 12),
    )

    return NextResponse.json({ current, timeline })
  } catch (err) {
    console.error("GET /api/vat error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    )
  }
}

// ─── POST ───────────────────────────────────────────────────────────────────

const RecalcSchema = z.object({
  organization_id: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  quarter: z.number().int().min(1).max(4),
})

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const parsed = RecalcSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten() },
        { status: 400 },
      )
    }

    const { organization_id: organizationId, year, quarter } = parsed.data

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

    const vatReturn = await calculateVatReturn(
      supabase,
      organizationId,
      year,
      quarter,
    )

    return NextResponse.json(vatReturn)
  } catch (err) {
    console.error("POST /api/vat error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 },
    )
  }
}
