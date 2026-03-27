/**
 * Analytics Service — Event Tracking
 *
 * Lightweight product analytics for tracking feature usage.
 * Non-fatal: errors are logged but never thrown.
 *
 * Usage (server-side):
 *   await trackEvent(supabase, {
 *     eventName: "document.uploaded",
 *     organizationId: orgId,
 *     userId: user.id,
 *     properties: { fileType: "pdf", source: "upload" },
 *   })
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TrackEventParams {
  eventName: string
  organizationId?: string | null
  userId?: string | null
  properties?: Record<string, unknown>
  sessionId?: string | null
}

export interface FeatureUsageStat {
  eventName: string
  count: number
  uniqueUsers: number
}

// ─── Track Event ─────────────────────────────────────────────────────────────

export async function trackEvent(
  supabase: SupabaseClient,
  params: TrackEventParams
): Promise<void> {
  try {
    const { error } = await supabase.from("analytics_events").insert({
      event_name: params.eventName,
      organization_id: params.organizationId ?? null,
      user_id: params.userId ?? null,
      properties: params.properties ?? {},
      session_id: params.sessionId ?? null,
    })

    if (error) {
      console.error("[analytics] Failed to track event:", error.message)
    }
  } catch (err) {
    // Non-fatal — analytics should never break the app
    console.error("[analytics] Unexpected error tracking event:", err)
  }
}

// ─── Query Feature Usage ─────────────────────────────────────────────────────

export async function getFeatureUsageStats(
  supabase: SupabaseClient,
  organizationId: string,
  options?: { fromDate?: Date; toDate?: Date }
): Promise<FeatureUsageStat[]> {
  try {
    let query = supabase
      .from("analytics_events")
      .select("event_name, user_id")
      .eq("organization_id", organizationId)

    if (options?.fromDate) {
      query = query.gte("created_at", options.fromDate.toISOString())
    }
    if (options?.toDate) {
      query = query.lte("created_at", options.toDate.toISOString())
    }

    const { data, error } = await query

    if (error) {
      console.error("[analytics] Failed to fetch usage stats:", error.message)
      return []
    }

    // Aggregate in application code (Supabase doesn't support GROUP BY directly)
    const eventMap = new Map<string, { count: number; users: Set<string> }>()

    for (const row of (data ?? []) as { event_name: string; user_id: string | null }[]) {
      const entry = eventMap.get(row.event_name) ?? { count: 0, users: new Set() }
      entry.count++
      if (row.user_id) entry.users.add(row.user_id)
      eventMap.set(row.event_name, entry)
    }

    return Array.from(eventMap.entries())
      .map(([eventName, stats]) => ({
        eventName,
        count: stats.count,
        uniqueUsers: stats.users.size,
      }))
      .sort((a, b) => b.count - a.count)
  } catch (err) {
    console.error("[analytics] Unexpected error fetching usage stats:", err)
    return []
  }
}
