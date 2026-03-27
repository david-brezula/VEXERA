"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useOrganization } from "@/providers/organization-provider"
import { queryKeys } from "@/shared/lib/query-keys"
import type { Rule, RuleCondition, RuleAction, RuleTargetEntity } from "@vexera/types"

interface CreateRuleInput {
  name: string
  description?: string
  is_active?: boolean
  priority?: number
  target_entity: RuleTargetEntity
  logic_operator?: 'AND' | 'OR'
  conditions: RuleCondition[]
  actions: RuleAction[]
}

interface UpdateRuleInput {
  id: string
  name?: string
  description?: string | null
  is_active?: boolean
  priority?: number
  target_entity?: RuleTargetEntity
  logic_operator?: 'AND' | 'OR'
  conditions?: RuleCondition[]
  actions?: RuleAction[]
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

// ─── useRules ────────────────────────────────────────────────────────────────

export function useRules(filters?: { target_entity?: string; active_only?: boolean }) {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""

  return useQuery({
    queryKey: queryKeys.rules.list(orgId, filters as Record<string, unknown> | undefined),
    queryFn: async () => {
      const params = new URLSearchParams({ organization_id: orgId })
      if (filters?.target_entity) params.set("target_entity", filters.target_entity)
      if (filters?.active_only) params.set("active_only", "true")

      const result = await fetchJson<{ data: Rule[] }>(`/api/rules?${params}`)
      return result.data
    },
    enabled: !!orgId,
  })
}

// ─── useCreateRule ───────────────────────────────────────────────────────────

export function useCreateRule() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: CreateRuleInput) => {
      if (!activeOrg) throw new Error("No organization selected")
      const result = await fetchJson<{ data: Rule }>("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, organization_id: activeOrg.id }),
      })
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rules.all(activeOrg?.id ?? "") })
      toast.success("Pravidlo vytvorené")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── useUpdateRule ───────────────────────────────────────────────────────────

export function useUpdateRule() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...fields }: UpdateRuleInput) => {
      const result = await fetchJson<{ data: Rule }>(`/api/rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      })
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rules.all(activeOrg?.id ?? "") })
      toast.success("Pravidlo aktualizované")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── useDeleteRule ───────────────────────────────────────────────────────────

export function useDeleteRule() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await fetchJson<{ success: boolean }>(`/api/rules/${id}`, { method: "DELETE" })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rules.all(activeOrg?.id ?? "") })
      toast.success("Pravidlo vymazané")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

// ─── useToggleRule ───────────────────────────────────────────────────────────

export function useToggleRule() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const result = await fetchJson<{ data: Rule }>(`/api/rules/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      })
      return result.data
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rules.all(activeOrg?.id ?? "") })
      toast.success(variables.is_active ? "Pravidlo zapnuté" : "Pravidlo vypnuté")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
