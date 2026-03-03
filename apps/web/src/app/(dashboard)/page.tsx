import { Suspense } from "react"
import { FileText, FolderOpen, BookOpen, TrendingUp } from "lucide-react"

import { getActiveOrgId } from "@/lib/data/org"
import { getDashboardStats, type DashboardStats } from "@/lib/data/dashboard"
import { formatEur } from "@vexera/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

// ─── Stats cards (async — streams in) ────────────────────────────────────────

async function DashboardStatsCards({ orgId }: { orgId: string }) {
  const stats = await getDashboardStats(orgId)
  return <StatCards stats={stats} />
}

function StatCards({ stats }: { stats: DashboardStats }) {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
          <FileText className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.invoiceCount}</div>
          <p className="text-xs text-muted-foreground">
            {stats.invoiceCount === 1 ? "invoice" : "invoices"} total
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Documents</CardTitle>
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{stats.documentCount}</div>
          <p className="text-xs text-muted-foreground">
            {stats.documentCount === 1 ? "document" : "documents"} uploaded
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Ledger Entries</CardTitle>
          <BookOpen className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">—</div>
          <p className="text-xs text-muted-foreground">Available in Phase 2</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Revenue</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatEur(stats.monthlyRevenue)}</div>
          <p className="text-xs text-muted-foreground">Paid invoices this month</p>
        </CardContent>
      </Card>
    </div>
  )
}

function StatCardsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-4 w-4 rounded" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-20" />
            <Skeleton className="h-3 w-24 mt-1" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const orgId = await getActiveOrgId()

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4">
        <h2 className="text-2xl font-bold">Welcome to Vexera</h2>
        <p className="text-muted-foreground">
          Create your first organization to get started.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
      </div>

      <Suspense fallback={<StatCardsSkeleton />}>
        <DashboardStatsCards orgId={orgId} />
      </Suspense>
    </div>
  )
}
