"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useOrganization } from "@/providers/organization-provider"
import { queryKeys } from "@/shared/lib/query-keys"
import type { Product } from "./service"

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function useProducts(activeOnly: boolean = false) {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""

  return useQuery({
    queryKey: queryKeys.products.list(orgId, { activeOnly }),
    queryFn: async () => {
      const params = new URLSearchParams({ organization_id: orgId })
      if (activeOnly) params.set("active_only", "true")
      const result = await fetchJson<{ data: Product[] }>(`/api/products?${params}`)
      return result.data
    },
    enabled: !!orgId,
  })
}

export function useCreateProduct() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (input: Record<string, unknown>) => {
      if (!activeOrg) throw new Error("No organization selected")
      const result = await fetchJson<{ data: Product }>("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...input, organization_id: activeOrg.id }),
      })
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all(activeOrg?.id ?? "") })
      toast.success("Produkt vytvorený")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useUpdateProduct() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, ...input }: { id: string } & Record<string, unknown>) => {
      const result = await fetchJson<{ data: Product }>(`/api/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      })
      return result.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all(activeOrg?.id ?? "") })
      toast.success("Produkt aktualizovaný")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}

export function useDeleteProduct() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      await fetchJson(`/api/products/${id}`, { method: "DELETE" })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.products.all(activeOrg?.id ?? "") })
      toast.success("Produkt odstránený")
    },
    onError: (err: Error) => toast.error(err.message),
  })
}
