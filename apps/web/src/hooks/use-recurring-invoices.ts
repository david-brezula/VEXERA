"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useOrganization } from "@/providers/organization-provider"
import { queryKeys } from "@/lib/query-keys"
import type { RecurringInvoiceTemplate } from "@/lib/services/recurring-invoice.service"

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function useRecurringInvoices(activeOnly: boolean = false) {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""

  return useQuery({
    queryKey: queryKeys.recurringInvoices.list(orgId, { activeOnly }),
    queryFn: async () => {
      const params = new URLSearchParams({ organization_id: orgId })
      if (activeOnly) params.set("active_only", "true")
      const result = await fetchJson<{ data: RecurringInvoiceTemplate[] }>(
        `/api/recurring-invoices?${params}`
      )
      return result.data
    },
    enabled: !!orgId,
  })
}

export function useCreateRecurringInvoice() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      if (!activeOrg) throw new Error("No organization selected")
      const result = await fetchJson<{ data: RecurringInvoiceTemplate }>(
        "/api/recurring-invoices",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...input, organization_id: activeOrg.id }),
        }
      )
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringInvoices.all(activeOrg?.id ?? "") })
      toast.success("Opakovaná faktúra vytvorená")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useToggleRecurringInvoice() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      await fetchJson(`/api/recurring-invoices/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active }),
      })
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringInvoices.all(activeOrg?.id ?? "") })
      toast.success(variables.is_active ? "Šablóna aktivovaná" : "Šablóna deaktivovaná")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteRecurringInvoice() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await fetchJson(`/api/recurring-invoices/${id}`, { method: "DELETE" })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.recurringInvoices.all(activeOrg?.id ?? "") })
      toast.success("Šablóna odstránená")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
