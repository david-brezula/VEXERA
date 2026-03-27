import { Suspense } from "react"
import { redirect } from "next/navigation"
import { getActiveOrg } from "@/features/settings/data-org"
import { getAccountantDashboard } from "@/features/reports/dashboard/accountant-data"
import { AccountantDashboard } from "@/features/reports/dashboard/components/accountant-dashboard"
import { Skeleton } from "@/shared/components/ui/skeleton"

export const metadata = { title: "Prehľad účtovníka | Vexera" }

async function DashboardContent({ orgId }: { orgId: string }) {
  const data = await getAccountantDashboard(orgId)
  return <AccountantDashboard data={data} />
}

export default async function AccountantDashboardPage() {
  const org = await getActiveOrg()

  if (!org) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Vyberte organizáciu pre zobrazenie prehľadu klientov</p>
      </div>
    )
  }

  if (org.organization_type !== "accounting_firm") {
    redirect("/dashboard")
  }

  const orgId = org.id

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Prehľad účtovníka</h1>
        <p className="text-muted-foreground mt-1">
          Sledujte všetkých klientov na jednom mieste
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <DashboardContent orgId={orgId} />
      </Suspense>
    </div>
  )
}
