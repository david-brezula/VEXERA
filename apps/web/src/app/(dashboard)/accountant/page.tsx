import { Suspense } from "react"
import { getActiveOrgId } from "@/lib/data/org"
import { getAccountantDashboard } from "@/lib/data/accountant-dashboard"
import { AccountantDashboard } from "@/components/dashboard/accountant-dashboard"
import { Skeleton } from "@/components/ui/skeleton"

export const metadata = { title: "Accountant Dashboard | Vexera" }

async function DashboardContent({ orgId }: { orgId: string }) {
  const data = await getAccountantDashboard(orgId)
  return <AccountantDashboard data={data} />
}

export default async function AccountantDashboardPage() {
  const orgId = await getActiveOrgId()

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Select an organization to view your client dashboard</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Accountant Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Monitor all your clients at a glance
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <DashboardContent orgId={orgId} />
      </Suspense>
    </div>
  )
}
