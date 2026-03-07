/**
 * GET /api/accountant/dashboard
 *
 * Returns AccountantDashboardData for the current organization.
 * Auth required — uses the active_organization_id cookie.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getAccountantDashboard } from "@/lib/data/accountant-dashboard"

export async function GET() {
  try {
    const supabase = await createClient()

    // Auth check
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Get active organization from cookie
    const { cookies } = await import("next/headers")
    const cookieStore = await cookies()
    const orgId = cookieStore.get("active_organization_id")?.value

    if (!orgId) {
      return NextResponse.json(
        { error: "No active organization selected" },
        { status: 400 }
      )
    }

    // Verify user is a member of the org
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", orgId)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const data = await getAccountantDashboard(orgId)

    return NextResponse.json({ data })
  } catch (err) {
    console.error("GET /api/accountant/dashboard error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
