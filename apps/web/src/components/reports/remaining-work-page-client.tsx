"use client"

import { useQuery } from "@tanstack/react-query"
import { useOrganization } from "@/providers/organization-provider"
import { queryKeys } from "@/lib/query-keys"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { RemainingWorkTable } from "./remaining-work-table"
import { Calendar, Clock, CheckCircle } from "lucide-react"
import type { RemainingWorkReport } from "@/lib/services/reports/report.types"

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json() as Promise<T>
}

export function RemainingWorkPageClient() {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""

  const { data: report, isLoading } = useQuery({
    queryKey: queryKeys.reports.remainingWork(orgId),
    queryFn: async () => {
      const result = await fetchJson<{ data: RemainingWorkReport }>(
        `/api/reports/remaining-work?organization_ids=${orgId}`
      )
      return result.data
    },
    enabled: !!orgId,
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
          <Skeleton className="h-24" />
        </div>
        <Skeleton className="h-64" />
      </div>
    )
  }

  if (!report) return null

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Najbližší termín
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report.deadlineLabel}</div>
            <p className="text-sm text-muted-foreground">{report.deadline}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Zostáva dní
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {report.daysUntil}
              <Badge
                variant={report.daysUntil <= 7 ? "destructive" : report.daysUntil <= 14 ? "secondary" : "outline"}
                className="ml-2 text-xs"
              >
                {report.daysUntil <= 7 ? "urgentné" : report.daysUntil <= 14 ? "blízko" : "v poriadku"}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <CheckCircle className="h-4 w-4" />
              Celková pripravenosť
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{report.overallReadiness}%</div>
            <Progress value={report.overallReadiness} className="mt-2 h-2" />
          </CardContent>
        </Card>
      </div>

      {/* Client table */}
      <Card>
        <CardHeader>
          <CardTitle>Prehľad klientov</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <RemainingWorkTable clients={report.clients} />
        </CardContent>
      </Card>
    </div>
  )
}
