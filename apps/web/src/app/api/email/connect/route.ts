/**
 * GET /api/email/connect
 *
 * Initiates Gmail OAuth2 authorization flow.
 * Redirects the user to Google's consent screen.
 *
 * Query params:
 *   organization_id — required UUID of the org connecting Gmail
 *
 * On success: redirects to Google consent screen
 * On error:   returns JSON { error: string }
 *
 * After user grants consent, Google redirects to:
 *   /api/email/callback?code=...&state=<organization_id>
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { buildAuthorizationUrl } from "@/lib/services/gmail.service"

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

    // Verify the user is a member of the organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const authUrl = buildAuthorizationUrl(organizationId)
    return NextResponse.redirect(authUrl)
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to initiate Gmail connection"
    console.error("GET /api/email/connect error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
