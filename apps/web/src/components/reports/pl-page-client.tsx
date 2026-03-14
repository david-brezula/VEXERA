"use client"

import { Fragment, useState, useMemo, useCallback, useTransition } from "react"
import { ArrowLeft, ArrowUp, ArrowDown, ChevronRight, ChevronDown, Download, Table as TableIcon } from "lucide-react"
import Link from "next/link"
import { useQuery } from "@tanstack/react-query"

import { useOrganization } from "@/providers/organization-provider"
import { queryKeys } from "@/lib/query-keys"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { PeriodSelector, periodOptions } from "./period-selector"
import { PLBarChart } from "@/components/charts/pl-bar-chart"
import { formatEur } from "@vexera/utils"
import type { PLReport } from "@/lib/services/reports/report.types"
import {
  exportPLReportPdfAction,
  exportPLReportExcelAction,
} from "@/lib/actions/report-export"

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
  const [isComparing, setIsComparing] = useState(false)
  const [expandedRow, setExpandedRow] = useState<string | null>(null)
  const [isPdfExporting, startPdfTransition] = useTransition()
  const [isExcelExporting, startExcelTransition] = useTransition()
  const period = periodOptions.find((p) => p.value === periodKey) ?? periodOptions[2]

  // Calculate previous period by shifting from/to back by the period length
  const comparisonPeriod = useMemo(() => {
    const fromDate = new Date(period.from)
    const toDate = new Date(period.to)
    const durationMs = toDate.getTime() - fromDate.getTime() + 86_400_000 // inclusive
    const prevTo = new Date(fromDate.getTime() - 86_400_000) // day before current from
    const prevFrom = new Date(prevTo.getTime() - durationMs + 86_400_000)
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
    return { from: fmt(prevFrom), to: fmt(prevTo) }
  }, [period.from, period.to])

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

  const comparisonQueryKey = tagType === "client"
    ? queryKeys.reports.clientPL(orgId, { from: comparisonPeriod.from, to: comparisonPeriod.to })
    : queryKeys.reports.projectPL(orgId, { from: comparisonPeriod.from, to: comparisonPeriod.to })

  const { data: comparisonReports = [] } = useQuery({
    queryKey: comparisonQueryKey,
    queryFn: async () => {
      const params = new URLSearchParams({
        organization_id: orgId,
        from: comparisonPeriod.from,
        to: comparisonPeriod.to,
        tag_type: tagType,
      })
      const result = await fetchJson<{ data: PLReport[] }>(
        `/api/reports/client-pl?${params}`
      )
      return result.data
    },
    enabled: !!orgId && isComparing,
  })

  const totalRevenue = reports.reduce((s, r) => s + r.totalRevenue, 0)
  const totalExpenses = reports.reduce((s, r) => s + r.totalExpenses, 0)
  const totalProfit = totalRevenue - totalExpenses

  const chartData = useMemo(
    () =>
      reports.map((r) => ({
        name: r.entityName,
        revenue: r.totalRevenue,
        expenses: r.totalExpenses,
      })),
    [reports]
  )

  const comparisonChartData = useMemo(() => {
    if (!isComparing || comparisonReports.length === 0) return undefined
    return comparisonReports.map((r) => ({
      name: r.entityName,
      revenue: r.totalRevenue,
      expenses: r.totalExpenses,
    }))
  }, [isComparing, comparisonReports])

  const handleCompareToggle = useCallback((checked: boolean) => {
    setIsComparing(checked)
  }, [])

  const handlePdfExport = useCallback(() => {
    startPdfTransition(async () => {
      const result = await exportPLReportPdfAction(period.from, period.to, tagType)
      if ("error" in result) return
      const blob = new Blob([result.html], { type: "text/html;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank")
    })
  }, [period.from, period.to, tagType])

  const handleExcelExport = useCallback(() => {
    startExcelTransition(async () => {
      const result = await exportPLReportExcelAction(period.from, period.to, tagType)
      if ("error" in result) return
      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0))
      const blob = new Blob([bytes], { type: "text/csv;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = result.filename
      a.click()
      URL.revokeObjectURL(url)
    })
  }, [period.from, period.to, tagType])

  const handleRowClick = useCallback((entityTagId: string) => {
    setExpandedRow((prev) => (prev === entityTagId ? null : entityTagId))
  }, [])

  const hasComparison = isComparing && comparisonReports.length > 0

  return (
    <>
      <div className="flex items-center gap-3 mb-2">
        <Link href="/reports" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <PeriodSelector value={periodKey} onValueChange={setPeriodKey} />

        <div className="flex items-center gap-2 ml-auto">
          <Button variant="outline" size="sm" onClick={handlePdfExport} disabled={isPdfExporting}>
            <Download className="size-4 mr-1" />
            {isPdfExporting ? "..." : "PDF"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleExcelExport} disabled={isExcelExporting}>
            <TableIcon className="size-4 mr-1" />
            {isExcelExporting ? "..." : "Excel"}
          </Button>
          <Switch
            id="pl-compare-toggle"
            checked={isComparing}
            onCheckedChange={handleCompareToggle}
          />
          <Label htmlFor="pl-compare-toggle" className="text-sm cursor-pointer">
            Porovnať s predchádzajúcim obdobím
          </Label>
        </div>
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

          {/* P&L Bar Chart */}
          {chartData.length > 0 && (
            <Card className="mt-4">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {tagType === "client" ? "Klienti" : "Projekty"} — Výnosy vs Náklady
                </CardTitle>
              </CardHeader>
              <CardContent>
                <PLBarChart data={chartData} comparisonData={comparisonChartData} />
              </CardContent>
            </Card>
          )}

          {/* P&L Table */}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[30px]" />
                <TableHead>{tagType === "client" ? "Klient" : "Projekt"}</TableHead>
                <TableHead className="text-right">Výnosy</TableHead>
                <TableHead className="text-right">Náklady</TableHead>
                <TableHead className="text-right">Zisk</TableHead>
                <TableHead className="text-right">Marža</TableHead>
                {hasComparison && <TableHead className="text-right">Predch. výnosy</TableHead>}
                {hasComparison && <TableHead className="text-right">Predch. náklady</TableHead>}
                {hasComparison && <TableHead className="text-right">Predch. zisk</TableHead>}
                {hasComparison && <TableHead className="text-right">Zmena</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {reports.map((report) => {
                const isExpanded = expandedRow === report.entityTagId
                const compReport = hasComparison
                  ? comparisonReports.find((c) => c.entityName === report.entityName)
                  : undefined

                return (
                  <Fragment key={report.entityTagId}>
                    <TableRow
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleRowClick(report.entityTagId)}
                    >
                      <TableCell className="pr-0">
                        {isExpanded ? (
                          <ChevronDown className="size-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="size-4 text-muted-foreground" />
                        )}
                      </TableCell>
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
                      {hasComparison && (
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {compReport
                            ? compReport.totalRevenue.toLocaleString("sk-SK", { minimumFractionDigits: 2 })
                            : "—"}
                        </TableCell>
                      )}
                      {hasComparison && (
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {compReport
                            ? compReport.totalExpenses.toLocaleString("sk-SK", { minimumFractionDigits: 2 })
                            : "—"}
                        </TableCell>
                      )}
                      {hasComparison && (
                        <TableCell className="text-right tabular-nums text-muted-foreground">
                          {compReport
                            ? compReport.netProfit.toLocaleString("sk-SK", { minimumFractionDigits: 2 })
                            : "—"}
                        </TableCell>
                      )}
                      {hasComparison && (
                        <TableCell className="text-right">
                          <ChangeIndicator
                            current={report.netProfit}
                            previous={compReport?.netProfit}
                          />
                        </TableCell>
                      )}
                    </TableRow>

                    {isExpanded && (
                      <TableRow key={`${report.entityTagId}-drilldown`}>
                        <TableCell colSpan={hasComparison ? 10 : 6} className="p-0">
                          <div className="bg-muted/30 px-8 py-3">
                            <div className="grid gap-4 md:grid-cols-2">
                              {/* Revenue breakdown */}
                              <div>
                                <h4 className="text-sm font-medium mb-2 text-green-600">Výnosy</h4>
                                {report.revenue.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Žiadne výnosy.</p>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Kategória</TableHead>
                                        <TableHead className="text-right">Suma</TableHead>
                                        <TableHead className="text-right">Počet</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {report.revenue.map((row) => (
                                        <TableRow key={row.label} className="text-sm">
                                          <TableCell>{row.label}</TableCell>
                                          <TableCell className="text-right tabular-nums">
                                            {formatEur(row.amount)}
                                          </TableCell>
                                          <TableCell className="text-right tabular-nums">
                                            {row.transactionCount}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </div>

                              {/* Expenses breakdown */}
                              <div>
                                <h4 className="text-sm font-medium mb-2 text-red-600">Náklady</h4>
                                {report.expenses.length === 0 ? (
                                  <p className="text-sm text-muted-foreground">Žiadne náklady.</p>
                                ) : (
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Kategória</TableHead>
                                        <TableHead className="text-right">Suma</TableHead>
                                        <TableHead className="text-right">Počet</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {report.expenses.map((row) => (
                                        <TableRow key={row.label} className="text-sm">
                                          <TableCell>{row.label}</TableCell>
                                          <TableCell className="text-right tabular-nums">
                                            {formatEur(row.amount)}
                                          </TableCell>
                                          <TableCell className="text-right tabular-nums">
                                            {row.transactionCount}
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                )}
                              </div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                )
              })}
            </TableBody>
          </Table>
        </>
      )}
    </>
  )
}

function ChangeIndicator({ current, previous }: { current: number; previous?: number }) {
  if (previous == null || previous === 0) {
    if (current === 0) return <span className="text-xs text-muted-foreground">—</span>
    return (
      <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600">
        <ArrowUp className="size-3" /> nové
      </span>
    )
  }

  const delta = ((current - previous) / Math.abs(previous)) * 100
  const formatted = `${delta > 0 ? "+" : ""}${delta.toFixed(1)}%`

  if (Math.abs(delta) < 0.1) {
    return <span className="text-xs text-muted-foreground">0,0%</span>
  }

  // For profit: increase is good (green), decrease is bad (red)
  return delta > 0 ? (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-green-600">
      <ArrowUp className="size-3" /> {formatted}
    </span>
  ) : (
    <span className="inline-flex items-center gap-0.5 text-xs font-medium text-red-600">
      <ArrowDown className="size-3" /> {formatted}
    </span>
  )
}
