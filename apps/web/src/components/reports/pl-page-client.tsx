"use client"

import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { useOrganization } from "@/providers/organization-provider"
import { queryKeys } from "@/lib/query-keys"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { PeriodSelector, periodOptions } from "./period-selector"
import type { PLReport } from "@/lib/services/reports/report.types"

interface PLPageClientProps {
  tagType: "client" | "project"
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error((err as { error?: string }).error ?? `Request failed: ${res.status}`)
  }
  return res.json() as Promise<T>
}

export function PLPageClient({ tagType }: PLPageClientProps) {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""
  const [periodKey, setPeriodKey] = useState("current_quarter")
  const period = periodOptions.find((p) => p.value === periodKey) ?? periodOptions[2]

  const queryKey = tagType === "client"
    ? queryKeys.reports.clientPL(orgId, { from: period.from, to: period.to })
    : queryKeys.reports.projectPL(orgId, { from: period.from, to: period.to })

  const { data: reports = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        organization_id: orgId,
        from: period.from,
        to: period.to,
        tag_type: tagType,
      })
      const result = await fetchJson<{ data: PLReport[] }>(
        `/api/reports/client-pl?${params}`
      )
      return result.data
    },
    enabled: !!orgId,
  })

  const totalRevenue = reports.reduce((s, r) => s + r.totalRevenue, 0)
  const totalExpenses = reports.reduce((s, r) => s + r.totalExpenses, 0)
  const totalProfit = totalRevenue - totalExpenses

  return (
    <>
      <div className="flex items-center gap-3 mb-2">
        <Link href="/reports" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <PeriodSelector value={periodKey} onValueChange={setPeriodKey} />
      </div>

      {!isLoading && reports.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Žiadne {tagType === "client" ? "klientské" : "projektové"} tagy.
            Najskôr pridajte tagy k dokladom a faktúram.
          </CardContent>
        </Card>
      )}

      {reports.length > 0 && (
        <>
          {/* Summary */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Celkové výnosy</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {totalRevenue.toLocaleString("sk-SK", { minimumFractionDigits: 2 })} EUR
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Celkové náklady</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {totalExpenses.toLocaleString("sk-SK", { minimumFractionDigits: 2 })} EUR
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Celkový zisk</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${totalProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {totalProfit.toLocaleString("sk-SK", { minimumFractionDigits: 2 })} EUR
                </div>
              </CardContent>
            </Card>
          </div>

          {/* P&L Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{tagType === "client" ? "Klient" : "Projekt"}</TableHead>
                <TableHead className="text-right">Výnosy</TableHead>
                <TableHead className="text-right">Náklady</TableHead>
                <TableHead className="text-right">Zisk</TableHead>
                <TableHead className="text-right">Marža</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => (
                <TableRow key={report.entityTagId}>
                  <TableCell className="font-medium">{report.entityName}</TableCell>
                  <TableCell className="text-right tabular-nums text-green-600">
                    {report.totalRevenue.toLocaleString("sk-SK", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-red-600">
                    {report.totalExpenses.toLocaleString("sk-SK", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className={`text-right tabular-nums font-medium ${report.netProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                    {report.netProfit.toLocaleString("sk-SK", { minimumFractionDigits: 2 })}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={report.margin >= 20 ? "secondary" : report.margin >= 0 ? "outline" : "destructive"}>
                      {report.margin}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </>
  )
}
