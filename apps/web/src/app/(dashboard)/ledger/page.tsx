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
import { PaginationControls } from "@/components/ui/pagination-controls"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Ledger | Vexera" }

async function LedgerContent({ page }: { page: number }) {
  const [entriesResult, accounts, balances, summary] = await Promise.all([
    getLedgerEntries(undefined, { page }),
    getChartOfAccounts(),
    getAccountBalances(),
    getLedgerSummary(),
  ])

  return (
    <>
      <LedgerClient
        entries={entriesResult.data}
        accounts={accounts}
        balances={balances}
        summary={summary}
      />
      <PaginationControls page={entriesResult.page} totalPages={entriesResult.totalPages} total={entriesResult.total} />
    </>
  )
}

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [params, orgId] = await Promise.all([searchParams, getActiveOrgId()])

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
        <LedgerContent page={Number(params.page) || 1} />
      </Suspense>
    </div>
  )
}
