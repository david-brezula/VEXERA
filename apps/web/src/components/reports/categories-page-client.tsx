"use client"

import { useState, useMemo, useCallback, useTransition } from "react"
import { ArrowLeft, Download, Table } from "lucide-react"
import Link from "next/link"

import { useCategoryReport } from "@/hooks/use-reports"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { PeriodSelector, periodOptions } from "./period-selector"
import { CategoryTable } from "./category-table"
import { CategoryBarChart } from "@/components/charts/category-bar-chart"
import {
  exportCategoryReportPdfAction,
  exportCategoryReportExcelAction,
} from "@/lib/actions/report-export"

export function CategoriesPageClient() {
  const [periodKey, setPeriodKey] = useState("current_quarter")
  const [activeTab, setActiveTab] = useState<"expenses" | "revenue">("expenses")
  const [isComparing, setIsComparing] = useState(false)
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

  const { data: report, isLoading } = useCategoryReport({
    from: period.from,
    to: period.to,
  })

  const { data: comparisonReport } = useCategoryReport({
    from: isComparing ? comparisonPeriod.from : "",
    to: isComparing ? comparisonPeriod.to : "",
  })

  const chartData = useMemo(() => {
    if (!report) return []
    const rows = activeTab === "expenses" ? report.expensesByCategory : report.revenueByCategory
    return rows.map((r) => ({ category: r.category, totalAmount: r.totalAmount }))
  }, [report, activeTab])

  const comparisonChartData = useMemo(() => {
    if (!comparisonReport || !isComparing) return undefined
    const rows = activeTab === "expenses" ? comparisonReport.expensesByCategory : comparisonReport.revenueByCategory
    return rows.map((r) => ({ category: r.category, totalAmount: r.totalAmount }))
  }, [comparisonReport, isComparing, activeTab])

  const handleCompareToggle = useCallback((checked: boolean) => {
    setIsComparing(checked)
  }, [])

  const handlePdfExport = useCallback(() => {
    startPdfTransition(async () => {
      const result = await exportCategoryReportPdfAction(period.from, period.to)
      if ("error" in result) return
      const blob = new Blob([result.html], { type: "text/html;charset=utf-8" })
      const url = URL.createObjectURL(blob)
      window.open(url, "_blank")
    })
  }, [period.from, period.to])

  const handleExcelExport = useCallback(() => {
    startExcelTransition(async () => {
      const result = await exportCategoryReportExcelAction(period.from, period.to)
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
  }, [period.from, period.to])

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
            <Table className="size-4 mr-1" />
            {isExcelExporting ? "..." : "Excel"}
          </Button>
          <Switch
            id="compare-toggle"
            checked={isComparing}
            onCheckedChange={handleCompareToggle}
          />
          <Label htmlFor="compare-toggle" className="text-sm cursor-pointer">
            Porovnať s predchádzajúcim obdobím
          </Label>
        </div>
      </div>

      {/* Summary cards */}
      {report && (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Výnosy</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {report.totalRevenue.toLocaleString("sk-SK", { minimumFractionDigits: 2 })} {report.currency}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Náklady</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {report.totalExpenses.toLocaleString("sk-SK", { minimumFractionDigits: 2 })} {report.currency}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Zisk</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${report.totalRevenue - report.totalExpenses >= 0 ? "text-green-600" : "text-red-600"}`}>
                {(report.totalRevenue - report.totalExpenses).toLocaleString("sk-SK", { minimumFractionDigits: 2 })} {report.currency}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Category bar chart */}
      {report && chartData.length > 0 && (
        <Card className="mt-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Top kategórie ({activeTab === "expenses" ? "Náklady" : "Výnosy"})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <CategoryBarChart
              data={chartData}
              type={activeTab}
              comparisonData={comparisonChartData}
            />
          </CardContent>
        </Card>
      )}

      {/* Category tables */}
      <Tabs defaultValue="expenses" onValueChange={(v) => setActiveTab(v as "expenses" | "revenue")}>
        <TabsList>
          <TabsTrigger value="expenses">Náklady</TabsTrigger>
          <TabsTrigger value="revenue">Výnosy</TabsTrigger>
        </TabsList>

        <TabsContent value="expenses">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Načítavam...</div>
          ) : (
            <CategoryTable
              rows={report?.expensesByCategory ?? []}
              total={report?.totalExpenses ?? 0}
              currency={report?.currency}
              comparisonRows={isComparing ? comparisonReport?.expensesByCategory : undefined}
            />
          )}
        </TabsContent>

        <TabsContent value="revenue">
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground">Načítavam...</div>
          ) : (
            <CategoryTable
              rows={report?.revenueByCategory ?? []}
              total={report?.totalRevenue ?? 0}
              currency={report?.currency}
              comparisonRows={isComparing ? comparisonReport?.revenueByCategory : undefined}
            />
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}
