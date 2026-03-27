"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useOrganization } from "@/providers/organization-provider"
import { queryKeys } from "@/shared/lib/query-keys"
import type { BankTransaction, BankAccount } from "@vexera/types"
import type { ReconcileMatch } from "./reconciliation.service"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface BankTransactionFilters {
  match_status?: string
  date_from?: string
  date_to?: string
  amount_min?: number
  amount_max?: number
}

export interface ImportResult {
  imported: number
  duplicates: number
  errors: string[]
  reconciled: number
  matches: ReconcileMatch[]
}

export interface ReconcileResult {
  reconciled: number
  suggestions: ReconcileMatch[]
  errors: string[]
  message?: string
}

// ─── useBankAccounts ─────────────────────────────────────────────────────────

export function useBankAccounts() {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""

  return useQuery<BankAccount[]>({
    queryKey: queryKeys.bank.accounts(orgId),
    queryFn: async () => {
      const res = await fetch(`/api/bank/accounts?organization_id=${orgId}`)
      if (!res.ok) throw new Error("Failed to fetch bank accounts")
      const json = (await res.json()) as { data: BankAccount[] }
      return json.data
    },
    enabled: !!orgId,
  })
}

// ─── useBankTransactions ─────────────────────────────────────────────────────

export function useBankTransactions(filters?: BankTransactionFilters) {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""

  return useQuery<BankTransaction[]>({
    queryKey: queryKeys.bank.transactions(orgId, filters as Record<string, unknown>),
    queryFn: async () => {
      const params = new URLSearchParams({ organization_id: orgId })
      if (filters?.match_status) params.set("match_status", filters.match_status)
      if (filters?.date_from) params.set("date_from", filters.date_from)
      if (filters?.date_to) params.set("date_to", filters.date_to)

      const res = await fetch(`/api/bank/transactions?${params.toString()}`)
      if (!res.ok) {
        // Fallback: fetch all from reconcile endpoint which returns transactions
        const fallbackRes = await fetch(`/api/bank/reconcile?organization_id=${orgId}&limit=500`)
        if (!fallbackRes.ok) throw new Error("Failed to fetch bank transactions")
        const json = (await fallbackRes.json()) as { data: BankTransaction[] }
        return json.data ?? []
      }
      const json = (await res.json()) as { data: BankTransaction[] }
      return json.data
    },
    enabled: !!orgId,
  })
}

// ─── useBankImport ───────────────────────────────────────────────────────────

export function useBankImport() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()
  const orgId = activeOrg?.id ?? ""

  return useMutation<
    ImportResult,
    Error,
    { file: File; bankAccountId: string }
  >({
    mutationFn: async ({ file, bankAccountId }) => {
      if (!orgId) throw new Error("No organization selected")

      const formData = new FormData()
      formData.append("file", file)
      formData.append("bank_account_id", bankAccountId)
      formData.append("organization_id", orgId)

      const res = await fetch("/api/bank/import", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? "Import failed")
      }

      return (await res.json()) as ImportResult
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bank.all(orgId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all(orgId) })
      toast.success(
        `Imported ${data.imported} transactions, ${data.reconciled} auto-matched`
      )
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

// ─── useRunReconciliation ────────────────────────────────────────────────────

export function useRunReconciliation() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()
  const orgId = activeOrg?.id ?? ""

  return useMutation<ReconcileResult, Error, { bankAccountId?: string }>({
    mutationFn: async ({ bankAccountId }) => {
      if (!orgId) throw new Error("No organization selected")

      const res = await fetch("/api/bank/reconcile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: orgId,
          bank_account_id: bankAccountId,
          auto_accept_high: true,
        }),
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? "Reconciliation failed")
      }

      return (await res.json()) as ReconcileResult
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bank.all(orgId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all(orgId) })
      toast.success(`${data.reconciled} transactions matched`)
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

// ─── useManualMatch ──────────────────────────────────────────────────────────

export function useManualMatch() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()
  const orgId = activeOrg?.id ?? ""

  return useMutation<
    void,
    Error,
    { transactionId: string; invoiceId: string }
  >({
    mutationFn: async ({ transactionId, invoiceId }) => {
      if (!orgId) throw new Error("No organization selected")

      const res = await fetch(`/api/bank/transactions/${transactionId}/match`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: orgId,
          invoice_id: invoiceId,
        }),
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? "Match failed")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bank.all(orgId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all(orgId) })
      toast.success("Transaction matched to invoice")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

// ─── useIgnoreTransaction ────────────────────────────────────────────────────

export function useIgnoreTransaction() {
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()
  const orgId = activeOrg?.id ?? ""

  return useMutation<void, Error, { transactionId: string }>({
    mutationFn: async ({ transactionId }) => {
      if (!orgId) throw new Error("No organization selected")

      const res = await fetch(`/api/bank/transactions/${transactionId}/match`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organization_id: orgId,
          match_status: "ignored",
        }),
      })

      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(err.error ?? "Failed to ignore transaction")
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.bank.all(orgId) })
      toast.success("Transaction marked as ignored")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}
