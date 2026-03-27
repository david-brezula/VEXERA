"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useOrganization } from "@/providers/organization-provider"
import { queryKeys } from "@/shared/lib/query-keys"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface HealthCheckRun {
  id: string
  organization_id: string
  triggered_by: string | null
  status: "running" | "completed" | "failed"
  total_issues: number
  critical_count: number
  warning_count: number
  info_count: number
  completed_at: string | null
  created_at: string
}

export interface HealthCheckIssue {
  id: string
  organization_id: string
  check_run_id: string
  document_id: string | null
  invoice_id: string | null
  check_type: string
  severity: "critical" | "warning" | "info"
  message: string
  details: Record<string, unknown>
  resolved: boolean
  resolved_at: string | null
  resolved_by: string | null
  created_at: string
}

interface HealthCheckData {
  run: HealthCheckRun | null
  issues: HealthCheckIssue[]
}

interface HealthCheckRunResult {
  runId: string
  totalIssues: number
  criticalCount: number
  warningCount: number
  infoCount: number
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── useHealthChecks ─────────────────────────────────────────────────────────

export function useHealthChecks(filters?: {
  resolved?: boolean
  severity?: string
  check_type?: string
}) {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""

  return useQuery({
    queryKey: queryKeys.healthChecks.issues(orgId, filters as Record<string, unknown> | undefined),
    queryFn: async () => {
      const params = new URLSearchParams({ organization_id: orgId })
      if (filters?.resolved !== undefined) params.set("resolved", String(filters.resolved))
      if (filters?.severity) params.set("severity", filters.severity)
      if (filters?.check_type) params.set("check_type", filters.check_type)

      const result = await fetchJson<{ data: HealthCheckData }>(`/api/health-checks?${params}`)
      return result.data
    },
    enabled: !!orgId,
  })
}

// ─── useRunHealthCheck ───────────────────────────────────────────────────────

export function useRunHealthCheck() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!activeOrg) throw new Error("No organization selected")
      const result = await fetchJson<{ data: HealthCheckRunResult }>("/api/health-checks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: activeOrg.id }),
      })
      return result.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.healthChecks.all(activeOrg?.id ?? "") })
      toast.success(`Kontrola dokončená: ${data.totalIssues} problémov nájdených`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── useResolveIssue ─────────────────────────────────────────────────────────

export function useResolveIssue() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (issueId: string) => {
      await fetchJson<{ data: { resolved: boolean } }>(
        `/api/health-checks/${issueId}/resolve`,
        { method: "PATCH" }
      )
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.healthChecks.all(activeOrg?.id ?? "") })
      toast.success("Problém označený ako vyriešený")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
