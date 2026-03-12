"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useOrganization } from "@/providers/organization-provider"
import { queryKeys } from "@/lib/query-keys"
import type { Contact } from "@/lib/services/contacts.service"

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function useContacts(filters?: { type?: string; search?: string; keyOnly?: boolean }) {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""

  return useQuery({
    queryKey: queryKeys.contacts.list(orgId, filters),
    queryFn: async () => {
      const params = new URLSearchParams({ organization_id: orgId })
      if (filters?.type) params.set("type", filters.type)
      if (filters?.search) params.set("search", filters.search)
      if (filters?.keyOnly) params.set("key_only", "true")
      const result = await fetchJson<{ data: Contact[] }>(`/api/contacts?${params}`)
      return result.data
    },
    enabled: !!orgId,
  })
}

export function useContact(contactId: string | null) {
  return useQuery({
    queryKey: ["contacts", "detail", contactId],
    queryFn: async () => {
      const result = await fetchJson<{ data: Contact }>(`/api/contacts/${contactId}`)
      return result.data
    },
    enabled: !!contactId,
  })
}

export function useCreateContact() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      if (!activeOrg) throw new Error("No organization selected")
      const result = await fetchJson<{ data: Contact }>("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, organization_id: activeOrg.id }),
      })
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all(activeOrg?.id ?? "") })
      toast.success("Kontakt vytvorený")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateContact() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const result = await fetchJson<{ data: Contact }>(`/api/contacts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all(activeOrg?.id ?? "") })
      toast.success("Kontakt aktualizovaný")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteContact() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await fetchJson(`/api/contacts/${id}`, { method: "DELETE" })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all(activeOrg?.id ?? "") })
      toast.success("Kontakt odstránený")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useImportContacts() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      if (!activeOrg) throw new Error("No organization selected")
      const result = await fetchJson<{ data: { created: number } }>("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organization_id: activeOrg.id }),
      })
      return result.data
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.contacts.all(activeOrg?.id ?? "") })
      toast.success(`Importovaných ${data.created} kontaktov z faktúr`)
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useLookupICO() {
  return useMutation({
    mutationFn: async (ico: string) => {
      const result = await fetchJson<{ data: Record<string, unknown> }>(
        `/api/contacts/lookup?ico=${encodeURIComponent(ico)}`
      )
      return result.data
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
