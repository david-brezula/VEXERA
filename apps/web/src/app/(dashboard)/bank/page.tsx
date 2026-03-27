import { LandmarkIcon } from "lucide-react"

import { getActiveOrgId } from "@/features/settings/data-org"
import { BankPageClient } from "@/features/bank"

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
        <p className="text-muted-foreground">Vyberte organizáciu pre zobrazenie bankových dát</p>
      </div>
    )
  }

  const initialTab = (params.tab as string | undefined) ?? "transactions"

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Banka</h1>
        <p className="text-muted-foreground">
          Spravujte bankové účty, importujte transakcie a párujte platby
        </p>
      </div>

      <BankPageClient initialTab={initialTab} />
    </div>
  )
}
