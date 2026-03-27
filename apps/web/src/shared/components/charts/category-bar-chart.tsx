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

interface CategoryBarData {
  category: string
  totalAmount: number
}

interface CategoryBarChartProps {
  data: CategoryBarData[]
  type: "expenses" | "revenue"
  comparisonData?: CategoryBarData[]
}

interface ChartRow {
  category: string
  amount: number
  previousAmount?: number
}

export function CategoryBarChart({ data, type, comparisonData }: CategoryBarChartProps) {
  const color = type === "expenses" ? "#ef4444" : "#3b82f6"
  const lightColor = type === "expenses" ? "#fca5a5" : "#93c5fd"

  const top10 = data
    .slice()
    .sort((a, b) => b.totalAmount - a.totalAmount)
    .slice(0, 10)

  const chartData: ChartRow[] = top10.map((item) => {
    const row: ChartRow = {
      category: item.category,
      amount: item.totalAmount,
    }
    if (comparisonData) {
      const match = comparisonData.find((c) => c.category === item.category)
      row.previousAmount = match?.totalAmount ?? 0
    }
    return row
  })

  if (chartData.length === 0) return null

  return (
    <ChartWrapper height={Math.max(350, chartData.length * 40)}>
      <BarChart data={chartData} layout="vertical" margin={{ left: 20, right: 20, top: 10, bottom: 10 }}>
        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tickFormatter={(v: number) => formatEur(v)}
          fontSize={12}
        />
        <YAxis
          type="category"
          dataKey="category"
          width={140}
          fontSize={12}
          tickLine={false}
        />
        <Tooltip content={<CustomTooltip hasComparison={!!comparisonData} />} />
        {comparisonData && (
          <Legend
            formatter={(value: string) =>
              value === "amount" ? "Aktuálne obdobie" : "Predchádzajúce obdobie"
            }
          />
        )}
        {comparisonData && (
          <Bar dataKey="previousAmount" fill={lightColor} radius={[0, 4, 4, 0]} name="previousAmount" />
        )}
        <Bar dataKey="amount" fill={color} radius={[0, 4, 4, 0]} name="amount" />
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

  const amountEntry = payload.find((p) => p.dataKey === "amount")
  const prevEntry = payload.find((p) => p.dataKey === "previousAmount")

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="font-medium mb-1">{label}</p>
      {amountEntry && (
        <p className="text-sm">
          {hasComparison ? "Aktuálne: " : ""}
          {formatEur(amountEntry.value)}
        </p>
      )}
      {prevEntry != null && hasComparison && (
        <p className="text-sm text-muted-foreground">
          Predchádzajúce: {formatEur(prevEntry.value)}
        </p>
      )}
    </div>
  )
}
