"use client"

import { useState } from "react"
import { ArrowLeft } from "lucide-react"
import Link from "next/link"

import { useCategoryReport } from "@/hooks/use-reports"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { PeriodSelector, periodOptions } from "./period-selector"
import { CategoryTable } from "./category-table"

export function CategoriesPageClient() {
  const [periodKey, setPeriodKey] = useState("current_quarter")
  const period = periodOptions.find((p) => p.value === periodKey) ?? periodOptions[2]

  const { data: report, isLoading } = useCategoryReport({
    from: period.from,
    to: period.to,
  })

  return (
    <>
      <div className="flex items-center gap-3 mb-2">
        <Link href="/reports" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-5" />
        </Link>
        <PeriodSelector value={periodKey} onValueChange={setPeriodKey} />
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

      {/* Category tables */}
      <Tabs defaultValue="expenses">
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
            />
          )}
        </TabsContent>
      </Tabs>
    </>
  )
}
