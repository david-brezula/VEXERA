import { LandmarkIcon } from "lucide-react"

import { getActiveOrgId } from "@/lib/data/org"
import { BankPageClient } from "@/components/bank/bank-page-client"

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function BankPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [params, orgId] = await Promise.all([searchParams, getActiveOrgId()])

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <LandmarkIcon className="size-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Select an organization to view bank data</p>
      </div>
    )
  }

  const initialTab = (params.tab as string | undefined) ?? "transactions"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Bank</h1>
        <p className="text-muted-foreground">
          Manage bank accounts, import transactions, and reconcile payments
        </p>
      </div>

      <BankPageClient initialTab={initialTab} />
    </div>
  )
}
