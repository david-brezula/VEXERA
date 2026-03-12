/**
 * PATCH  /api/cashflow-scenarios/[id] — update a scenario
 * DELETE /api/cashflow-scenarios/[id] — delete a scenario
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { updateScenario, deleteScenario } from "@/lib/services/cashflow-scenarios.service"

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
    const scenario = await updateScenario(supabase, id, body)

    return NextResponse.json({ data: scenario })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params
    await deleteScenario(supabase, id)

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
