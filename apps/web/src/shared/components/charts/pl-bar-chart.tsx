"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from "recharts"
import { formatEur } from "@vexera/utils"
import { ChartWrapper } from "./chart-wrapper"

interface PLBarData {
  name: string
  revenue: number
  expenses: number
}

interface PLBarChartProps {
  data: PLBarData[]
  comparisonData?: PLBarData[]
}

interface ChartRow {
  name: string
  revenue: number
  expenses: number
  prevRevenue?: number
  prevExpenses?: number
}

export function PLBarChart({ data, comparisonData }: PLBarChartProps) {
  const top10 = data
    .slice()
    .sort((a, b) => (b.revenue + b.expenses) - (a.revenue + a.expenses))
    .slice(0, 10)

  const chartData: ChartRow[] = top10.map((item) => {
    const row: ChartRow = {
      name: item.name,
      revenue: item.revenue,
      expenses: item.expenses,
    }
    if (comparisonData) {
      const match = comparisonData.find((c) => c.name === item.name)
      row.prevRevenue = match?.revenue ?? 0
      row.prevExpenses = match?.expenses ?? 0
    }
    return row
  })

  if (chartData.length === 0) return null

  const hasComparison = !!comparisonData

  return (
    <ChartWrapper height={Math.max(350, chartData.length * 50)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatEur(v)}
          fontSize={12}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={140}
          fontSize={12}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip hasComparison={hasComparison} />} />
        {hasComparison && (
          <Legend
            formatter={(value: string) => {
              switch (value) {
                case "revenue": return "Výnosy"
                case "expenses": return "Náklady"
                case "prevRevenue": return "Výnosy (predch.)"
                case "prevExpenses": return "Náklady (predch.)"
                default: return value
              }
            }}
          />
        )}
        {hasComparison && (
          <Bar dataKey="prevRevenue" fill="#86efac" radius={[0, 4, 4, 0]} name="prevRevenue" />
        )}
        {hasComparison && (
          <Bar dataKey="prevExpenses" fill="#fca5a5" radius={[0, 4, 4, 0]} name="prevExpenses" />
        )}
        <Bar dataKey="revenue" fill="#22c55e" radius={[0, 4, 4, 0]} name="revenue" />
        <Bar dataKey="expenses" fill="#ef4444" radius={[0, 4, 4, 0]} name="expenses" />
      </BarChart>
    </ChartWrapper>
  )
}

function CustomTooltip({
  active,
  payload,
  label,
  hasComparison,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string }>
  label?: string
  hasComparison: boolean
}) {
  if (!active || !payload?.length) return null

  const revenue = payload.find((p) => p.dataKey === "revenue")?.value ?? 0
  const expenses = payload.find((p) => p.dataKey === "expenses")?.value ?? 0
  const profit = revenue - expenses

  const prevRevenue = payload.find((p) => p.dataKey === "prevRevenue")?.value
  const prevExpenses = payload.find((p) => p.dataKey === "prevExpenses")?.value

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-medium mb-1">{label}</p>
      <p className="text-sm text-green-600">
        {hasComparison ? "Výnosy: " : "Výnosy: "}{formatEur(revenue)}
      </p>
      <p className="text-sm text-red-600">
        {hasComparison ? "Náklady: " : "Náklady: "}{formatEur(expenses)}
      </p>
      <p className={`text-sm font-medium ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
        Zisk: {formatEur(profit)}
      </p>
      {hasComparison && prevRevenue != null && prevExpenses != null && (
        <>
          <hr className="my-1 border-border" />
          <p className="text-sm text-muted-foreground">Predch. výnosy: {formatEur(prevRevenue)}</p>
          <p className="text-sm text-muted-foreground">Predch. náklady: {formatEur(prevExpenses)}</p>
          <p className="text-sm text-muted-foreground">
            Predch. zisk: {formatEur(prevRevenue - prevExpenses)}
          </p>
        </>
      )}
    </div>
  )
}
