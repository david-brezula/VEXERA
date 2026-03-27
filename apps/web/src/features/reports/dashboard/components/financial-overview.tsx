"use client"

import { formatEur } from "@vexera/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/shared/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table"
import type { FinancialStats } from "@/features/reports/dashboard/financial-stats"

interface FinancialOverviewProps {
  stats: FinancialStats
}

interface StatCardProps {
  title: string
  value: number
  subtitle: string
  colorClass?: string
}

function StatCard({ title, value, subtitle, colorClass }: StatCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${colorClass ?? ""}`}>{formatEur(value)}</div>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
      </CardContent>
    </Card>
  )
}

export function FinancialOverview({ stats }: FinancialOverviewProps) {
  const {
    currentRevenue,
    currentExpenses,
    currentProfit,
    vatCollected,
    vatDeductible,
    vatPosition,
    taxEstimate,
    monthlyTrend,
  } = stats

  const profitColor = currentProfit >= 0 ? "text-green-600" : "text-red-600"
  const vatPositionColor = vatPosition >= 0 ? "text-red-600" : "text-green-600"
  const vatPositionSubtitle =
    vatPosition >= 0 ? "Suma na úhradu daňovému úradu" : "Nárok na vrátenie DPH"

  // The last row in the trend is the current month
  const currentMonthLabel = monthlyTrend[monthlyTrend.length - 1]?.month

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div>
        <h2 className="text-lg font-semibold">Finančný prehľad</h2>
        <p className="text-sm text-muted-foreground">Aktuálny mesiac · aktualizované priebežne</p>
      </div>

      {/* P&L stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Príjmy"
          value={currentRevenue}
          subtitle="Zaplatené vydané faktúry"
          colorClass="text-green-600"
        />
        <StatCard
          title="Výdavky"
          value={currentExpenses}
          subtitle="Zaplatené prijaté faktúry"
          colorClass="text-red-600"
        />
        <StatCard
          title="Zisk"
          value={currentProfit}
          subtitle="Čistý zisk tento mesiac"
          colorClass={profitColor}
        />
      </div>

      {/* VAT stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="DPH odvedená"
          value={vatCollected}
          subtitle="DPH na výstupe"
        />
        <StatCard
          title="DPH odpočítateľná"
          value={vatDeductible}
          subtitle="DPH na vstupe (odpočítateľná)"
        />
        <StatCard
          title="Pozícia DPH"
          value={vatPosition}
          subtitle={vatPositionSubtitle}
          colorClass={vatPositionColor}
        />
      </div>

      {/* Tax estimate — full width */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Odhadovaná daň z príjmov</CardTitle>
          <CardDescription className="text-xs">
            Odhadovaná daň z príjmov (15 % zo zisku) — skutočnú výšku konzultujte s účtovníkom
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatEur(taxEstimate)}</div>
        </CardContent>
      </Card>

      {/* Monthly trend table */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Mesačný trend — posledných 6 mesiacov</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mesiac</TableHead>
                <TableHead className="text-right">Príjmy</TableHead>
                <TableHead className="text-right">Výdavky</TableHead>
                <TableHead className="text-right">Zisk</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyTrend.map((row, idx) => {
                const isCurrentMonth = row.month === currentMonthLabel && idx === monthlyTrend.length - 1
                const profitRowColor = row.profit >= 0 ? "text-green-600" : "text-red-600"
                return (
                  <TableRow key={row.month} className={isCurrentMonth ? "font-bold" : ""}>
                    <TableCell className={isCurrentMonth ? "font-bold" : ""}>{row.month}</TableCell>
                    <TableCell className={`text-right ${isCurrentMonth ? "font-bold" : ""}`}>
                      {formatEur(row.revenue)}
                    </TableCell>
                    <TableCell className={`text-right ${isCurrentMonth ? "font-bold" : ""}`}>
                      {formatEur(row.expenses)}
                    </TableCell>
                    <TableCell className={`text-right ${profitRowColor} ${isCurrentMonth ? "font-bold" : ""}`}>
                      {formatEur(row.profit)}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      </div>
    </div>
  )
}
