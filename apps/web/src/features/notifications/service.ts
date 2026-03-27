/**
 * Notification Service — server-side
 *
 * Creates and retrieves in-app notifications stored in the `notifications` table.
 * Uses the Supabase service-role client for writes (users cannot self-create notifications).
 *
 * Usage in Server Actions / Edge Functions / API routes:
 *
 *   // From a server action (uses existing supabase client):
 *   await createNotification(supabase, {
 *     organizationId,
 *     userId:     targetUser.id,
 *     type:       'invoice_overdue',
 *     title:      'Invoice #2024-042 is overdue',
 *     body:       'The invoice for Acme Corp (€1,500) was due on 2024-03-01.',
 *     entityType: 'invoice',
 *     entityId:   invoice.id,
 *     metadata:   { amount: 1500, currency: 'EUR' },
 *   })
 *
 * Non-fatal: errors are logged but never thrown.
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { CreateNotificationParams, Notification } from "@vexera/types"

// ─── createNotification ───────────────────────────────────────────────────────

/**
 * Insert a single notification row.
 * Requires a server client with enough privileges to insert.
 * Non-fatal: never throws.
 */
export async function createNotification(
  supabase: SupabaseClient,
  params: CreateNotificationParams
): Promise<void> {
  try {
    const { error } = await supabase.from("notifications").insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? null,
    })

    if (error) {
      console.error("[notification] Failed to create notification:", error.message, {
        type: params.type,
        userId: params.userId,
      })
    }
  } catch (err) {
    console.error("[notification] Unexpected error:", err)
  }
}

// ─── createNotificationForAllMembers ─────────────────────────────────────────

/**
 * Send the same notification to all members of an organization.
 * Useful for org-wide events (bank import done, export ready, etc.)
 */
export async function createNotificationForAllMembers(
  supabase: SupabaseClient,
  params: Omit<CreateNotificationParams, "userId">
): Promise<void> {
  try {
    const { data: members } = await supabase
      .from("organization_members")
      .select("user_id")
      .eq("organization_id", params.organizationId)

    if (!members || members.length === 0) return

    const rows = (members as Array<{ user_id: string }>).map((m) => ({
      organization_id: params.organizationId,
      user_id: m.user_id,
      type: params.type,
      title: params.title,
      body: params.body ?? null,
      entity_type: params.entityType ?? null,
      entity_id: params.entityId ?? null,
      metadata: params.metadata ?? null,
    }))

    const { error } = await supabase.from("notifications").insert(rows)

    if (error) {
      console.error("[notification] Failed to fan-out notification:", error.message, {
        type: params.type,
        orgId: params.organizationId,
        memberCount: members.length,
      })
    }
  } catch (err) {
    console.error("[notification] Unexpected error in fan-out:", err)
  }
}

// ─── listNotifications ────────────────────────────────────────────────────────

export interface ListNotificationsOptions {
  organizationId: string
  unreadOnly?: boolean
  limit?: number
  offset?: number
}

/**
 * Fetch notifications for the authenticated user within an org.
 * RLS ensures users only see their own rows.
 */
export async function listNotifications(
  supabase: SupabaseClient,
  options: ListNotificationsOptions
): Promise<Notification[]> {
  const limit = options.limit ?? 50
  const offset = options.offset ?? 0

  let query = supabase.from("notifications")
    .select("id, organization_id, user_id, type, title, body, entity_type, entity_id, metadata, is_read, read_at, created_at")
    .eq("organization_id", options.organizationId)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (options.unreadOnly) {
    query = query.eq("is_read", false)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to list notifications: ${error.message}`)
  return (data ?? []) as Notification[]
}

// ─── markAsRead ───────────────────────────────────────────────────────────────

/**
 * Mark one or more notifications as read.
 * RLS ensures users can only update their own rows.
 */
export async function markNotificationsRead(
  supabase: SupabaseClient,
  notificationIds: string[]
): Promise<void> {
  if (notificationIds.length === 0) return

  const { error } = await supabase.from("notifications")
    .update({ is_read: true, read_at: new Date().toISOString() })
    .in("id", notificationIds)

  if (error) throw new Error(`Failed to mark notifications as read: ${error.message}`)
}

// ─── countUnread ─────────────────────────────────────────────────────────────

/**
 * Return the count of unread notifications for the current user in an org.
 * Used for the notification badge in the UI.
 */
export async function countUnreadNotifications(
  supabase: SupabaseClient,
  organizationId: string
): Promise<number> {
  const { count, error } = await supabase.from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_read", false)

  if (error) return 0
  return count ?? 0
}
