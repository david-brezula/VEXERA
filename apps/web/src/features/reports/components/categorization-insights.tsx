"use client"

import { useQuery } from "@tanstack/react-query"
import { useOrganization } from "@/providers/organization-provider"
import { Badge } from "@/shared/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/components/ui/card"
import { Skeleton } from "@/shared/components/ui/skeleton"
import { TrendingDown, TrendingUp, Minus } from "lucide-react"

interface CorrectionInsight {
  category: string
  correctionCount: number
  accuracyTrend: "improving" | "stable" | "declining"
  topSuppliers: string[]
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json() as Promise<T>
}

export function CategorizationInsights() {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""

  const { data: insights, isLoading } = useQuery({
    queryKey: ["categorization-insights", orgId],
    queryFn: async () => {
      const result = await fetchJson<{ data: CorrectionInsight[] }>(
        `/api/categorization/insights?organization_id=${orgId}`
      )
      return result.data
    },
    enabled: !!orgId,
  })

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Kategorizačné štatistiky</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    )
  }

  if (!insights || insights.length === 0) {
    return (
      <Card>
        <CardHeader><CardTitle>Kategorizačné štatistiky</CardTitle></CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">Zatiaľ žiadne opravy kategorizácie</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kategorizačné štatistiky</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {insights.map((insight) => (
            <div
              key={insight.category}
              className="flex items-center justify-between rounded-md border px-3 py-2"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{insight.category}</span>
                  <TrendIcon trend={insight.accuracyTrend} />
                </div>
                {insight.topSuppliers.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {insight.topSuppliers.join(", ")}
                  </p>
                )}
              </div>
              <Badge variant="secondary">{insight.correctionCount} opráv</Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

function TrendIcon({ trend }: { trend: "improving" | "stable" | "declining" }) {
  if (trend === "improving") return <TrendingDown className="h-3.5 w-3.5 text-green-600" />
  if (trend === "declining") return <TrendingUp className="h-3.5 w-3.5 text-red-500" />
  return <Minus className="h-3.5 w-3.5 text-muted-foreground" />
}
