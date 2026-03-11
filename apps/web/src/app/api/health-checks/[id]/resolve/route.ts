/**
 * PATCH /api/health-checks/[id]/resolve — mark a health check issue as resolved
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { resolveHealthCheckIssue } from "@/lib/services/health-check.service"

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id } = await params

    // Verify the issue exists and user has access (via RLS)
    const { data: issue } = await supabase
      .from("health_check_results")
      .select("id, organization_id")
      .eq("id", id)
      .single()

    if (!issue) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const success = await resolveHealthCheckIssue(supabase, id, user.id)

    if (!success) {
      return NextResponse.json({ error: "Failed to resolve issue" }, { status: 500 })
    }

    return NextResponse.json({ data: { resolved: true } })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
