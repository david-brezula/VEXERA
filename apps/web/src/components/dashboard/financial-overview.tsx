"use client"

import { formatEur } from "@vexera/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { FinancialStats } from "@/lib/data/financial-stats"

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
    vatPosition >= 0 ? "Amount owed to tax authority" : "VAT refund due"

  // The last row in the trend is the current month
  const currentMonthLabel = monthlyTrend[monthlyTrend.length - 1]?.month

  return (
    <div className="space-y-6">
      {/* Section header */}
      <div>
        <h2 className="text-lg font-semibold">Financial Overview</h2>
        <p className="text-sm text-muted-foreground">Current month · updated live</p>
      </div>

      {/* P&L stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="Revenue"
          value={currentRevenue}
          subtitle="Paid invoices issued"
          colorClass="text-green-600"
        />
        <StatCard
          title="Expenses"
          value={currentExpenses}
          subtitle="Paid invoices received"
          colorClass="text-red-600"
        />
        <StatCard
          title="Profit"
          value={currentProfit}
          subtitle="Net this month"
          colorClass={profitColor}
        />
      </div>

      {/* VAT stat cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <StatCard
          title="VAT Collected"
          value={vatCollected}
          subtitle="Output VAT"
        />
        <StatCard
          title="VAT Deductible"
          value={vatDeductible}
          subtitle="Input VAT (deductible)"
        />
        <StatCard
          title="VAT Position"
          value={vatPosition}
          subtitle={vatPositionSubtitle}
          colorClass={vatPositionColor}
        />
      </div>

      {/* Tax estimate — full width */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Estimated Income Tax</CardTitle>
          <CardDescription className="text-xs">
            Estimated income tax (15% of profit) — consult your accountant for the actual liability
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{formatEur(taxEstimate)}</div>
        </CardContent>
      </Card>

      {/* Monthly trend table */}
      <div>
        <h3 className="text-sm font-semibold mb-3">Monthly Trend — Last 6 Months</h3>
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Expenses</TableHead>
                <TableHead className="text-right">Profit</TableHead>
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
