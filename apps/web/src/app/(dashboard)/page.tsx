"use client"

import { useQuery } from "@tanstack/react-query"
import { FileText, FolderOpen, BookOpen, TrendingUp } from "lucide-react"

import { useOrganization } from "@/providers/organization-provider"
import { useSupabase } from "@/providers/supabase-provider"
import { queryKeys } from "@/lib/query-keys"
import { formatEur } from "@vexera/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

export default function DashboardPage() {
  const { activeOrg } = useOrganization()
  const { supabase } = useSupabase()

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.dashboard.stats(activeOrg?.id ?? ""),
    queryFn: async () => {
      const orgId = activeOrg!.id
      const startOfMonth = new Date()
      startOfMonth.setDate(1)
      startOfMonth.setHours(0, 0, 0, 0)

      const [invoiceResult, documentResult, revenueResult] = await Promise.all([
        // Total invoices (not deleted)
        supabase
          .from("invoices")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .is("deleted_at", null),

        // Total documents (not deleted)
        supabase
          .from("documents")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .is("deleted_at", null),

        // Paid issued invoices this month
        supabase
          .from("invoices")
          .select("total")
          .eq("organization_id", orgId)
          .eq("invoice_type", "issued")
          .eq("status", "paid")
          .gte("paid_at", startOfMonth.toISOString())
          .is("deleted_at", null),
      ])

      const invoiceCount = invoiceResult.count ?? 0
      const documentCount = documentResult.count ?? 0
      const monthlyRevenue = (revenueResult.data ?? []).reduce(
        (sum, row) => sum + (row.total ?? 0),
        0
      )

      return { invoiceCount, documentCount, monthlyRevenue }
    },
    enabled: !!activeOrg,
  })

  if (!activeOrg) {
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
        <p className="text-muted-foreground">Overview for {activeOrg.name}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.invoiceCount ?? 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.invoiceCount === 1 ? "invoice" : "invoices"} total
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Documents</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <>
                <div className="text-2xl font-bold">{stats?.documentCount ?? 0}</div>
                <p className="text-xs text-muted-foreground">
                  {stats?.documentCount === 1 ? "document" : "documents"} uploaded
                </p>
              </>
            )}
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
            {isLoading ? (
              <Skeleton className="h-8 w-24" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {formatEur(stats?.monthlyRevenue ?? 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Paid invoices this month
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
