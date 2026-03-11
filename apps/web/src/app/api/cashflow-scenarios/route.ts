/**
 * GET  /api/cashflow-scenarios — list scenarios for an organization
 * POST /api/cashflow-scenarios — create a new scenario
 *
 * Query params (GET):
 *   organization_id — required
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { listScenarios, createScenario } from "@/lib/services/cashflow-scenarios.service"

const adjustmentSchema = z.object({
  type: z.enum(["add_inflow", "add_outflow", "delay_payment", "remove_item"]),
  amount: z.number().optional(),
  days: z.number().optional(),
  description: z.string().optional(),
  date: z.string().optional(),
})

const createSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1),
  description: z.string().nullish(),
  color: z.string().default("#2563eb"),
  adjustments: z.array(adjustmentSchema),
})

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

    const scenarios = await listScenarios(supabase, organizationId)
    return NextResponse.json({ data: scenarios })
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
    const parsed = createSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 })
    }

    const { organization_id, ...input } = parsed.data
    const scenario = await createScenario(supabase, organization_id, user.id, input)

    return NextResponse.json({ data: scenario }, { status: 201 })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
