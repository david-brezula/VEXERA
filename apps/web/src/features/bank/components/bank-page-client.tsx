"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { RefreshCwIcon, Loader2Icon } from "lucide-react"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/components/ui/tabs"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import { Button } from "@/shared/components/ui/button"
import { Badge } from "@/shared/components/ui/badge"
import { BankTransactionsTable } from "./bank-transactions-table"
import { BankImportWizard } from "./bank-import-wizard"
import { ReconcileSuggestionsPanel } from "./reconcile-suggestions-panel"
import { RecurringPatternsPanel } from "./recurring-patterns-panel"
import { useBankAccounts, useRunReconciliation } from "../hooks"
import type { ReconcileResult } from "../hooks"

// ─── Match status filter options ──────────────────────────────────────────────

const MATCH_STATUS_OPTIONS = [
  { value: "all", label: "Všetky stavy" },
  { value: "unmatched", label: "Nespárované" },
  { value: "matched", label: "Spárované" },
  { value: "manually_matched", label: "Manuálne spárované" },
  { value: "ignored", label: "Ignorované" },
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
  const [patternCount, setPatternCount] = useState(0)

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
        <TabsTrigger value="transactions">Transakcie</TabsTrigger>
        <TabsTrigger value="import">Import</TabsTrigger>
        <TabsTrigger value="reconcile">Párovanie</TabsTrigger>
        <TabsTrigger value="patterns" className="gap-1.5">
          Vzory
          {patternCount > 0 && (
            <Badge variant="secondary" className="ml-1 px-1.5 py-0.5 text-xs">
              {patternCount}
            </Badge>
          )}
        </TabsTrigger>
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
              <SelectValue placeholder="Všetky účty" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všetky účty</SelectItem>
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
              <SelectValue placeholder="Všetky stavy" />
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
            <h2 className="text-lg font-semibold">Automatické párovanie</h2>
            <p className="text-sm text-muted-foreground">
              Automaticky spárujte bankové transakcie s otvorenými faktúrami
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
            Spustiť automatické párovanie
          </Button>
        </div>

        <ReconcileSuggestionsPanel result={reconcileResult} />
      </TabsContent>

      {/* ── Patterns Tab ───────────────────────────────────────────────── */}
      <TabsContent value="patterns" className="mt-4">
        <RecurringPatternsPanel onCountChange={setPatternCount} />
      </TabsContent>
    </Tabs>
  )
}
