import { Suspense } from "react"
import { BookOpen } from "lucide-react"

import { getActiveOrgId } from "@/lib/data/org"
import {
  getLedgerEntries,
  getChartOfAccounts,
  getAccountBalances,
  getLedgerSummary,
} from "@/lib/data/ledger"
import { LedgerClient } from "@/components/ledger/ledger-client"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Ledger | Vexera" }

async function LedgerContent() {
  const [entries, accounts, balances, summary] = await Promise.all([
    getLedgerEntries(),
    getChartOfAccounts(),
    getAccountBalances(),
    getLedgerSummary(),
  ])

  return (
    <LedgerClient
      entries={entries}
      accounts={accounts}
      balances={balances}
      summary={summary}
    />
  )
}

export default async function LedgerPage() {
  const orgId = await getActiveOrgId()

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <BookOpen className="size-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          Select an organization to view the ledger
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ledger</h1>
        <p className="text-muted-foreground">
          General ledger, chart of accounts & balances
        </p>
      </div>
      <Suspense
        fallback={<Skeleton className="h-[500px] w-full rounded-xl" />}
      >
        <LedgerContent />
      </Suspense>
    </div>
  )
}
