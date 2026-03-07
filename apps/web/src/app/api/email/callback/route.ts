/**
 * GET /api/email/callback
 *
 * Gmail OAuth2 callback — handles the redirect from Google after user grants consent.
 *
 * Google appends:
 *   code  — authorization code to exchange for tokens
 *   state — organizationId passed in the connect step
 *
 * On success: saves tokens to email_connections, redirects to /settings/email
 * On error:   redirects to /settings/email?error=<message>
 *
 * Security: the user must still be authenticated (session cookie must be valid).
 * This prevents CSRF attacks on the callback endpoint.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { exchangeCodeForTokens } from "@/lib/services/gmail.service"
import { writeAuditLog } from "@/lib/services/audit.server"

const SETTINGS_EMAIL_URL = "/settings/email"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const organizationId = url.searchParams.get("state")
  const oauthError = url.searchParams.get("error")

  // Google returned an error (e.g. user denied consent)
  if (oauthError) {
    const redirectUrl = new URL(SETTINGS_EMAIL_URL, url.origin)
    redirectUrl.searchParams.set("error", `Google OAuth error: ${oauthError}`)
    return NextResponse.redirect(redirectUrl.toString())
  }

  if (!code || !organizationId) {
    const redirectUrl = new URL(SETTINGS_EMAIL_URL, url.origin)
    redirectUrl.searchParams.set("error", "Missing authorization code or state")
    return NextResponse.redirect(redirectUrl.toString())
  }

  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      const redirectUrl = new URL("/login", url.origin)
      return NextResponse.redirect(redirectUrl.toString())
    }

    // Verify the user is still a member of the organization from state param
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      const redirectUrl = new URL(SETTINGS_EMAIL_URL, url.origin)
      redirectUrl.searchParams.set("error", "You are not a member of this organization")
      return NextResponse.redirect(redirectUrl.toString())
    }

    // Exchange code for tokens
    const tokens = await exchangeCodeForTokens(code)

    // Upsert the connection (update tokens if this Gmail account was previously connected)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const emailConnTable = supabase.from("email_connections" as any) as any
    const { error: upsertError } = await emailConnTable
      .upsert(
        {
          organization_id: organizationId,
          created_by: user.id,
          email_address: tokens.email,
          google_user_id: tokens.googleUserId,
          access_token: tokens.accessToken,
          refresh_token: tokens.refreshToken,
          token_expires_at: tokens.expiresAt.toISOString(),
          is_active: true,
          last_error: null,
        },
        {
          onConflict: "organization_id,google_user_id",
        }
      )

    if (upsertError) {
      console.error("Failed to save email connection:", upsertError)
      const redirectUrl = new URL(SETTINGS_EMAIL_URL, url.origin)
      redirectUrl.searchParams.set("error", "Failed to save Gmail connection")
      return NextResponse.redirect(redirectUrl.toString())
    }

    // Audit log
    await writeAuditLog(supabase, {
      organizationId,
      userId: user.id,
      action: "EMAIL_CONNECTED",
      entityType: "organization",
      entityId: organizationId,
      newData: { email_address: tokens.email },
    })

    const redirectUrl = new URL(SETTINGS_EMAIL_URL, url.origin)
    redirectUrl.searchParams.set("connected", tokens.email)
    return NextResponse.redirect(redirectUrl.toString())
  } catch (err) {
    console.error("GET /api/email/callback error:", err)
    const redirectUrl = new URL(SETTINGS_EMAIL_URL, url.origin)
    redirectUrl.searchParams.set(
      "error",
      err instanceof Error ? err.message : "Gmail connection failed"
    )
    return NextResponse.redirect(redirectUrl.toString())
  }
}
