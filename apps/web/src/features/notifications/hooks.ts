"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useOrganization } from "@/providers/organization-provider"
import { queryKeys } from "@/shared/lib/query-keys"
import type { Notification } from "@vexera/types"

export type { Notification }

interface NotificationsResponse {
  data: Notification[]
  unread_count: number
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── useNotifications ────────────────────────────────────────────────────────

export function useNotifications(opts?: { unreadOnly?: boolean; limit?: number; offset?: number }) {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""

  return useQuery({
    queryKey: queryKeys.notifications.list(orgId, opts as Record<string, unknown> | undefined),
    queryFn: async () => {
      const params = new URLSearchParams({ organization_id: orgId })
      if (opts?.unreadOnly) params.set("unread_only", "true")
      if (opts?.limit) params.set("limit", String(opts.limit))
      if (opts?.offset) params.set("offset", String(opts.offset))

      return fetchJson<NotificationsResponse>(`/api/notifications?${params}`)
    },
    enabled: !!orgId,
    refetchInterval: 60_000,
  })
}

// ─── useUnreadCount ──────────────────────────────────────────────────────────

export function useUnreadCount() {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""

  return useQuery({
    queryKey: queryKeys.notifications.unreadCount(orgId),
    queryFn: async () => {
      const params = new URLSearchParams({
        organization_id: orgId,
        limit: "1",
      })
      const result = await fetchJson<NotificationsResponse>(`/api/notifications?${params}`)
      return result.unread_count
    },
    enabled: !!orgId,
    refetchInterval: 60_000,
  })
}

// ─── useMarkAsRead ───────────────────────────────────────────────────────────

export function useMarkAsRead() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (ids: string[]) => {
      await fetchJson<{ updated: number }>("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      })
    },
    onSuccess: () => {
      const orgId = activeOrg?.id ?? ""
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all(orgId) })
    },
  })
}

// ─── useMarkAllAsRead ────────────────────────────────────────────────────────

export function useMarkAllAsRead() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!activeOrg) throw new Error("No organization selected")
      await fetchJson<{ updated: number }>("/api/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ all: true, organization_id: activeOrg.id }),
      })
    },
    onSuccess: () => {
      const orgId = activeOrg?.id ?? ""
      queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all(orgId) })
    },
  })
}
