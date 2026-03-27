/**
 * GET   /api/notifications  — list notifications for the current user
 * PATCH /api/notifications  — mark notifications as read
 *
 * GET query params:
 *   organization_id — required
 *   unread_only     — "true" to return only unread (default: all)
 *   limit           — default 50
 *   offset          — default 0
 *
 * GET returns:
 *   { data: Notification[], unread_count: number }
 *
 * PATCH body (JSON):
 *   { ids: string[] }   — notification UUIDs to mark as read
 *   OR
 *   { all: true, organization_id: string }  — mark ALL unread as read
 *
 * PATCH returns:
 *   { updated: number }
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import {
  listNotifications,
  markNotificationsRead,
  countUnreadNotifications,
} from "@/features/notifications/service"
import { verifyOrgMembership, forbiddenResponse } from "@/shared/lib/api-utils"

// ─── GET ──────────────────────────────────────────────────────────────────────

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

    // Verify user belongs to the organization (defense in depth alongside RLS)
    const membership = await verifyOrgMembership(supabase, user.id, organizationId)
    if (!membership) return forbiddenResponse()

    const [notifications, unreadCount] = await Promise.all([
      listNotifications(supabase, {
        organizationId,
        unreadOnly: url.searchParams.get("unread_only") === "true",
        limit: parseInt(url.searchParams.get("limit") ?? "50"),
        offset: parseInt(url.searchParams.get("offset") ?? "0"),
      }),
      countUnreadNotifications(supabase, organizationId),
    ])

    return NextResponse.json({ data: notifications, unread_count: unreadCount })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

const PatchByIdsSchema = z.object({
  ids: z.array(z.string()).min(1),
})

const PatchAllSchema = z.object({
  all: z.literal(true),
  organization_id: z.string().uuid(),
})

const PatchSchema = z.union([PatchByIdsSchema, PatchAllSchema])

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const parsed = PatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    if ("all" in parsed.data) {
      // Verify org membership before bulk update
      const mem = await verifyOrgMembership(supabase, user.id, parsed.data.organization_id)
      if (!mem) return forbiddenResponse()
      // Mark all unread for this user+org as read
      const { data: unread } = await supabase.from("notifications")
        .select("id")
        .eq("organization_id", parsed.data.organization_id)
        .eq("user_id", user.id)
        .eq("is_read", false)

      const ids = (unread ?? []).map((n: { id: string }) => n.id)
      if (ids.length > 0) await markNotificationsRead(supabase, ids)

      return NextResponse.json({ updated: ids.length })
    } else {
      await markNotificationsRead(supabase, parsed.data.ids)
      return NextResponse.json({ updated: parsed.data.ids.length })
    }
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
