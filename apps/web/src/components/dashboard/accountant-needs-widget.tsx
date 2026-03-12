"use client"

import { useQuery } from "@tanstack/react-query"
import { useOrganization } from "@/providers/organization-provider"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { AlertCircle, FileText, Receipt, ArrowRight } from "lucide-react"
import Link from "next/link"

interface AccountantNeed {
  type: string
  title: string
  description: string
  count: number
  severity: "high" | "medium" | "low"
  actionUrl?: string
}

interface AccountantNeedsSummary {
  needs: AccountantNeed[]
  totalIssues: number
  urgentCount: number
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json() as Promise<T>
}

const typeIcons: Record<string, typeof AlertCircle> = {
  missing_document: FileText,
  incomplete_invoice: Receipt,
  pending_approval: AlertCircle,
  unmatched_transaction: ArrowRight,
}

const severityColors: Record<string, string> = {
  high: "text-red-500",
  medium: "text-yellow-500",
  low: "text-blue-500",
}

export function AccountantNeedsWidget() {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""

  const { data, isLoading } = useQuery({
    queryKey: ["accountant-needs", orgId],
    queryFn: async () => {
      const result = await fetchJson<{ data: AccountantNeedsSummary }>(
        `/api/accountant-needs?organization_id=${orgId}`
      )
      return result.data
    },
    enabled: !!orgId,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Čo účtovník potrebuje</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!data || data.needs.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Čo účtovník potrebuje</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Všetko je v poriadku! Žiadne nevyriešené úlohy.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle>Čo účtovník potrebuje</CardTitle>
          {data.urgentCount > 0 && (
            <Badge variant="destructive">{data.urgentCount} urgentných</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {data.needs.map((need, i) => {
            const Icon = typeIcons[need.type] ?? AlertCircle
            return (
              <Link
                key={i}
                href={need.actionUrl ?? "#"}
                className="flex items-center gap-3 rounded-md border p-3 hover:bg-muted/50 transition-colors"
              >
                <Icon className={`h-5 w-5 shrink-0 ${severityColors[need.severity]}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium">{need.title}</div>
                  <div className="text-xs text-muted-foreground">{need.description}</div>
                </div>
                <Badge variant="secondary">{need.count}</Badge>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
