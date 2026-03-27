"use client"

import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react"
import { formatEur } from "@vexera/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table"
import { CashflowAreaChart } from "@/shared/components/charts/cashflow-area-chart"
import type { CashFlowSummary, CashFlowPoint } from "@/features/reports/cashflow/data"

interface CashFlowWidgetProps {
  summary: CashFlowSummary
  forecast: CashFlowPoint[]
}

export function CashFlowWidget({ summary, forecast }: CashFlowWidgetProps) {
  const isAtRisk = summary.risk_date !== null
  const trend30d = summary.forecast_30d - summary.current_balance
  const trendUp = trend30d >= 0

  // Sample every 7 days for the forecast table
  const weeklyPoints = forecast.filter((_, i) => i % 7 === 0 || i === forecast.length - 1)

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Predpoveď cash flow</h2>
        <p className="text-sm text-muted-foreground">90-dňová projekcia na základe faktúr a opakujúcich sa vzorov</p>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Aktuálny zostatok</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatEur(summary.current_balance)}</div>
            <p className="text-xs text-muted-foreground mt-1">Celkom na bankových účtoch</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Predpoveď na 30 dní</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatEur(summary.forecast_30d)}</div>
            <div className="flex items-center gap-1 mt-1">
              {trendUp ? (
                <TrendingUp className="h-3 w-3 text-green-600" />
              ) : (
                <TrendingDown className="h-3 w-3 text-red-600" />
              )}
              <span className={`text-xs font-medium ${trendUp ? "text-green-600" : "text-red-600"}`}>
                {trendUp ? "+" : ""}{formatEur(trend30d)}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Predpoveď na 60 dní</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatEur(summary.forecast_60d)}</div>
          </CardContent>
        </Card>

        <Card className={isAtRisk ? "border-destructive" : ""}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Predpoveď na 90 dní</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${isAtRisk ? "text-destructive" : ""}`}>
              {formatEur(summary.forecast_90d)}
            </div>
            {isAtRisk && (
              <div className="flex items-center gap-1 mt-1">
                <AlertTriangle className="h-3 w-3 text-destructive" />
                <span className="text-xs text-destructive font-medium">
                  Klesne do mínusu {new Date(summary.risk_date!).toLocaleDateString("sk-SK")}
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Risk alert */}
      {isAtRisk && (
        <Card className="border-destructive bg-destructive/5">
          <CardContent className="pt-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-destructive">Zistené riziko cash flow</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Predpokladaný zostatok klesne pod nulu{" "}
                  <strong>{new Date(summary.risk_date!).toLocaleDateString("sk-SK")}</strong>.
                  Zvážte urýchlenie inkasa pohľadávok alebo úpravu výdavkov.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Area chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Graf predpovede</CardTitle>
          <CardDescription className="text-xs">
            Predpokladaný zostatok na nasledujúcich 90 dní
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CashflowAreaChart
            forecast={forecast.map((p) => ({
              date: p.date,
              balance: p.balance,
              inflows: p.inflows,
              outflows: p.outflows,
            }))}
          />
        </CardContent>
      </Card>

      {/* Weekly forecast table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Týždenná projekcia</CardTitle>
          <CardDescription className="text-xs">
            Predpokladaný zostatok v týždenných intervaloch
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Dátum</TableHead>
              <TableHead className="text-right">Príjmy</TableHead>
              <TableHead className="text-right">Výdavky</TableHead>
              <TableHead className="text-right">Zostatok</TableHead>
              <TableHead />
            </TableRow>
          </TableHeader>
          <TableBody>
            {weeklyPoints.map((point) => {
              const isNegative = point.balance < 0
              return (
                <TableRow key={point.date}>
                  <TableCell className="text-sm">
                    {new Date(point.date).toLocaleDateString("sk-SK")}
                  </TableCell>
                  <TableCell className="text-right text-sm text-green-600 tabular-nums">
                    {point.inflows > 0 ? `+${formatEur(point.inflows)}` : "—"}
                  </TableCell>
                  <TableCell className="text-right text-sm text-red-600 tabular-nums">
                    {point.outflows > 0 ? `-${formatEur(point.outflows)}` : "—"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium tabular-nums ${isNegative ? "text-destructive" : ""}`}
                  >
                    {formatEur(point.balance)}
                  </TableCell>
                  <TableCell className="w-10">
                    {isNegative && (
                      <Badge variant="destructive" className="text-xs">Riziko</Badge>
                    )}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </Card>
    </div>
  )
}
