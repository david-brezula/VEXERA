/**
 * Shared API route utilities for authentication and authorization.
 */

import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Verify that the authenticated user is a member of the given organization.
 * Returns the membership row on success, or null if not a member.
 */
export async function verifyOrgMembership(
  supabase: SupabaseClient,
  userId: string,
  organizationId: string
): Promise<{ id: string } | null> {
  const { data } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .single()

  return data as { id: string } | null
}

/** Standard 403 response for non-members */
export function forbiddenResponse() {
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

/**
 * Sanitize a search string for safe use in Supabase PostgREST `.or()` filters.
 * Escapes characters that have special meaning in PostgREST filter syntax.
 */
export function sanitizePostgrestSearch(input: string): string {
  // Escape backslashes first, then commas, dots, and percent signs
  // that could be used to inject additional filter operators
  return input
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/\./g, "\\.")
}
