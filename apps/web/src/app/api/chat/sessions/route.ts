/**
 * GET /api/chat/sessions — list chat sessions for current user
 *
 * Query params:
 *   organization_id — required
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { listSessions } from "@/features/chat/service"

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

    const sessions = await listSessions(supabase, organizationId, user.id)

    return NextResponse.json({ data: sessions })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
