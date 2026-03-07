"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { RefreshCwIcon, Loader2Icon } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { BankTransactionsTable } from "@/components/bank/bank-transactions-table"
import { BankImportWizard } from "@/components/bank/bank-import-wizard"
import { ReconcileSuggestionsPanel } from "@/components/bank/reconcile-suggestions-panel"
import { useBankAccounts, useRunReconciliation } from "@/hooks/use-bank"
import type { ReconcileResult } from "@/hooks/use-bank"

// ─── Match status filter options ──────────────────────────────────────────────

const MATCH_STATUS_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "unmatched", label: "Unmatched" },
  { value: "matched", label: "Matched" },
  { value: "manually_matched", label: "Manually matched" },
  { value: "ignored", label: "Ignored" },
]

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  initialTab: string
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BankPageClient({ initialTab }: Props) {
  const router = useRouter()
  const pathname = usePathname()

  const [activeTab, setActiveTab] = useState(initialTab)
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all")
  const [selectedMatchStatus, setSelectedMatchStatus] = useState<string>("all")
  const [reconcileResult, setReconcileResult] = useState<ReconcileResult | null>(null)

  const { data: accounts = [], isLoading: accountsLoading } = useBankAccounts()
  const runReconciliation = useRunReconciliation()

  function handleTabChange(tab: string) {
    setActiveTab(tab)
    router.replace(`${pathname}?tab=${tab}`)
  }

  async function handleRunReconciliation() {
    const accountId = selectedAccountId !== "all" ? selectedAccountId : undefined
    const result = await runReconciliation.mutateAsync({ bankAccountId: accountId })
    setReconcileResult(result)
  }

  const transactionFilters = {
    match_status: selectedMatchStatus !== "all" ? selectedMatchStatus : undefined,
    bank_account_id: selectedAccountId !== "all" ? selectedAccountId : undefined,
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList>
        <TabsTrigger value="transactions">Transactions</TabsTrigger>
        <TabsTrigger value="import">Import</TabsTrigger>
        <TabsTrigger value="reconcile">Reconcile</TabsTrigger>
      </TabsList>

      {/* ── Transactions Tab ─────────────────────────────────────────────── */}
      <TabsContent value="transactions" className="space-y-4 mt-4">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Account filter */}
          <Select
            value={selectedAccountId}
            onValueChange={setSelectedAccountId}
            disabled={accountsLoading}
          >
            <SelectTrigger className="w-52">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((account) => (
                <SelectItem key={account.id} value={account.id}>
                  {account.bank_name} — {account.iban.slice(-8)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Match status filter */}
          <Select value={selectedMatchStatus} onValueChange={setSelectedMatchStatus}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="All statuses" />
            </SelectTrigger>
            <SelectContent>
              {MATCH_STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <BankTransactionsTable
          matchStatus={transactionFilters.match_status}
          bankAccountId={transactionFilters.bank_account_id}
        />
      </TabsContent>

      {/* ── Import Tab ───────────────────────────────────────────────────── */}
      <TabsContent value="import" className="mt-4">
        <BankImportWizard />
      </TabsContent>

      {/* ── Reconcile Tab ────────────────────────────────────────────────── */}
      <TabsContent value="reconcile" className="space-y-6 mt-4">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-lg font-semibold">Auto-Reconciliation</h2>
            <p className="text-sm text-muted-foreground">
              Match unmatched bank transactions to open invoices automatically
            </p>
          </div>
          <Button
            onClick={handleRunReconciliation}
            disabled={runReconciliation.isPending}
            className="ml-auto"
          >
            {runReconciliation.isPending ? (
              <Loader2Icon className="size-4 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-4" />
            )}
            Run Auto-Reconcile
          </Button>
        </div>

        <ReconcileSuggestionsPanel result={reconcileResult} />
      </TabsContent>
    </Tabs>
  )
}
