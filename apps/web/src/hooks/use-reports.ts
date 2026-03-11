"use client"

import { useQuery } from "@tanstack/react-query"
import { useOrganization } from "@/providers/organization-provider"
import { queryKeys } from "@/lib/query-keys"
import type { CategoryBreakdown } from "@/lib/services/reports/report.types"

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── useCategoryReport ───────────────────────────────────────────────────────

export function useCategoryReport(period: { from: string; to: string }) {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""

  return useQuery({
    queryKey: queryKeys.reports.categories(orgId, period),
    queryFn: async () => {
      const params = new URLSearchParams({
        organization_id: orgId,
        from: period.from,
        to: period.to,
      })
      const result = await fetchJson<{ data: CategoryBreakdown }>(
        `/api/reports/category?${params}`
      )
      return result.data
    },
    enabled: !!orgId && !!period.from && !!period.to,
  })
}
