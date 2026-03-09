/**
 * GET /api/audit
 *
 * Fetches audit log entries for an organization.
 *
 * Query params:
 *   organization_id  — required
 *   entity_type      — optional filter (invoice, document, bank_account, etc.)
 *   entity_id        — optional filter (show history for one entity)
 *   action           — optional filter
 *   limit            — default 50
 *   offset           — default 0
 *
 * Response 200: { data: AuditLogEntry[], count: number }
 * Response 400/401/403/500: { error: string }
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AuditLogEntry {
  id: string
  organization_id: string
  user_id: string | null
  action: string
  entity_type: string | null
  entity_id: string | null
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
}

// ─── Validation ────────────────────────────────────────────────────────────────

const querySchema = z.object({
  organization_id: z.string().uuid("organization_id must be a valid UUID"),
  entity_type: z.string().min(1).optional(),
  entity_id: z.string().uuid("entity_id must be a valid UUID").optional(),
  action: z.string().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(500).default(50),
  offset: z.coerce.number().int().min(0).default(0),
})

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const raw = Object.fromEntries(searchParams.entries())
    const parsed = querySchema.safeParse(raw)

    if (!parsed.success) {
      const message = parsed.error.issues.map((e: { message: string }) => e.message).join("; ")
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const { organization_id, entity_type, entity_id, action, limit, offset } =
      parsed.data

    // Verify org membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this organization" },
        { status: 403 }
      )
    }

    // audit_logs IS in the Phase 0 placeholder types — no cast needed
    let query = supabase
      .from("audit_logs")
      .select("*", { count: "exact" })
      .eq("organization_id", organization_id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (entity_type) {
      query = query.eq("entity_type", entity_type)
    }

    if (entity_id) {
      query = query.eq("entity_id", entity_id)
    }

    if (action) {
      query = query.eq("action", action)
    }

    const { data, error, count } = await query

    if (error) {
      console.error("audit GET error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: (data ?? []) as AuditLogEntry[],
      count: count ?? 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch audit log"
    console.error("audit GET error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
