"use client"

import { useQuery } from "@tanstack/react-query"
import { useOrganization } from "@/providers/organization-provider"
import { queryKeys } from "@/lib/query-keys"
import { useCallback, useRef } from "react"
import type { CategoryBreakdown } from "@/lib/services/reports/report.types"

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── Cache metadata ──────────────────────────────────────────────────────────

interface CachedResponse<T> {
  data: T
  cached?: boolean
  generatedAt?: string
}

// ─── useCategoryReport ───────────────────────────────────────────────────────

export function useCategoryReport(period: { from: string; to: string }) {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""
  const refreshRef = useRef(false)

  const query = useQuery({
    queryKey: [...queryKeys.reports.categories(orgId, period), refreshRef.current ? "refresh" : ""],
    queryFn: async () => {
      const params = new URLSearchParams({
        organization_id: orgId,
        from: period.from,
        to: period.to,
      })
      if (refreshRef.current) {
        params.set("refresh", "true")
      }
      const result = await fetchJson<CachedResponse<CategoryBreakdown>>(
        `/api/reports/category?${params}`
      )
      // Reset refresh flag after fetch completes
      refreshRef.current = false
      return result
    },
    enabled: !!orgId && !!period.from && !!period.to,
  })

  const refresh = useCallback(() => {
    refreshRef.current = true
    query.refetch()
  }, [query])

  return {
    ...query,
    data: query.data?.data,
    cached: query.data?.cached,
    generatedAt: query.data?.generatedAt,
    refresh,
  }
}
