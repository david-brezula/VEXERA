"use client"

import { useCallback } from "react"
import { useOrganization } from "@/providers/organization-provider"

/**
 * Client-side analytics hook.
 * Fires events to /api/analytics endpoint.
 * Non-blocking — errors are silently ignored.
 *
 * Usage:
 *   const trackEvent = useTrackEvent()
 *   trackEvent("invoice.created", { amount: 1500 })
 */
export function useTrackEvent() {
  const { activeOrg } = useOrganization()

  return useCallback(
    (eventName: string, properties?: Record<string, unknown>) => {
      // Fire and forget — don't await, don't block UI
      fetch("/api/analytics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event_name: eventName,
          organization_id: activeOrg?.id ?? null,
          properties: properties ?? {},
        }),
      }).catch(() => {
        // Silently ignore analytics failures
      })
    },
    [activeOrg?.id]
  )
}
