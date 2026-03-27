import { Suspense } from "react"
import { BookOpen } from "lucide-react"

import { getActiveOrgId } from "@/features/settings/data-org"
import {
  getJournalEntries,
  getChartOfAccounts,
  getAccountBalances,
  getLedgerSummary,
  getFiscalPeriods,
  LedgerClient,
} from "@/features/ledger"
import { PaginationControls } from "@/shared/components/ui/pagination-controls"
import { Skeleton } from "@/shared/components/ui/skeleton"

export const metadata = { title: "Ledger | Vexera" }

async function LedgerContent({ page }: { page: number }) {
  const currentYear = new Date().getFullYear()

  const [entriesResult, accounts, balances, summary, fiscalPeriods] =
    await Promise.all([
      getJournalEntries(undefined, { page }),
      getChartOfAccounts(),
      getAccountBalances(),
      getLedgerSummary(),
      getFiscalPeriods(currentYear),
    ])

  return (
    <>
      <LedgerClient
        entries={entriesResult.data}
        accounts={accounts}
        balances={balances}
        summary={summary}
        fiscalPeriods={fiscalPeriods}
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
          Vyberte organizáciu pre zobrazenie účtovnej knihy
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Účtovná kniha</h1>
        <p className="text-muted-foreground">
          Hlavná kniha, účtový rozvrh a zostatky
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
