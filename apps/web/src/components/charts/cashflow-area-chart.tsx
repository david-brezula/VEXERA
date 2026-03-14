"use client"

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  Legend,
  Line,
  CartesianGrid,
} from "recharts"
import { formatEur } from "@vexera/utils"
import { ChartWrapper } from "./chart-wrapper"

interface ForecastPoint {
  date: string
  balance: number
  inflows: number
  outflows: number
}

interface ScenarioLine {
  name: string
  color: string
  points: { date: string; balance: number }[]
}

interface CashflowAreaChartProps {
  forecast: ForecastPoint[]
  scenarios?: ScenarioLine[]
  height?: number
}

function formatDateTick(dateStr: string): string {
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, "0")
  const month = String(d.getMonth() + 1).padStart(2, "0")
  return `${day}.${month}`
}

export function CashflowAreaChart({
  forecast,
  scenarios,
  height = 300,
}: CashflowAreaChartProps) {
  // Merge scenario data into forecast points for recharts
  const chartData = forecast.map((point) => {
    const row: Record<string, string | number> = {
      date: point.date,
      balance: point.balance,
      inflows: point.inflows,
      outflows: point.outflows,
    }

    if (scenarios) {
      for (const scenario of scenarios) {
        const match = scenario.points.find((p) => p.date === point.date)
        if (match) {
          row[scenario.name] = match.balance
        }
      }
    }

    return row
  })

  const hasScenarios = scenarios && scenarios.length > 0

  return (
    <ChartWrapper height={height}>
      <AreaChart
        data={chartData}
        margin={{ left: 10, right: 10, top: 10, bottom: 0 }}
      >
        <defs>
          <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#22c55e" stopOpacity={0} />
          </linearGradient>
        </defs>

        <CartesianGrid strokeDasharray="3 3" vertical={false} />

        <XAxis
          dataKey="date"
          tickFormatter={formatDateTick}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          interval="preserveStartEnd"
        />
        <YAxis
          tickFormatter={(v: number) => formatEur(v)}
          fontSize={12}
          tickLine={false}
          axisLine={false}
          width={90}
        />

        <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="4 4" />

        <Tooltip content={<CashflowTooltip />} />

        {hasScenarios && (
          <Legend
            verticalAlign="top"
            height={36}
            formatter={(value: string) => (
              <span className="text-xs">{value}</span>
            )}
          />
        )}

        <Area
          type="monotone"
          dataKey="balance"
          stroke="#22c55e"
          strokeWidth={2}
          fill="url(#balanceGradient)"
          name="Forecast"
          dot={false}
          activeDot={{ r: 4 }}
        />

        {hasScenarios &&
          scenarios.map((scenario) => (
            <Line
              key={scenario.name}
              type="monotone"
              dataKey={scenario.name}
              stroke={scenario.color}
              strokeWidth={1.5}
              strokeDasharray="5 3"
              dot={false}
              name={scenario.name}
            />
          ))}
      </AreaChart>
    </ChartWrapper>
  )
}

function CashflowTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ value: number; dataKey: string; color: string; name: string }>
  label?: string
}) {
  if (!active || !payload?.length) return null

  const balanceEntry = payload.find((p) => p.dataKey === "balance")
  const inflowsEntry = payload.find((p) => p.dataKey === "inflows")
  const outflowsEntry = payload.find((p) => p.dataKey === "outflows")
  const scenarioEntries = payload.filter(
    (p) => !["balance", "inflows", "outflows"].includes(p.dataKey)
  )

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md min-w-[180px]">
      <p className="font-medium text-sm mb-2">
        {label ? formatDateTick(label) : ""}
      </p>
      {balanceEntry != null && (
        <p className="text-sm flex justify-between gap-4">
          <span className="text-muted-foreground">Balance</span>
          <span className="font-medium">{formatEur(balanceEntry.value)}</span>
        </p>
      )}
      {inflowsEntry != null && inflowsEntry.value > 0 && (
        <p className="text-sm flex justify-between gap-4">
          <span className="text-muted-foreground">Inflows</span>
          <span className="text-green-600">+{formatEur(inflowsEntry.value)}</span>
        </p>
      )}
      {outflowsEntry != null && outflowsEntry.value > 0 && (
        <p className="text-sm flex justify-between gap-4">
          <span className="text-muted-foreground">Outflows</span>
          <span className="text-red-600">-{formatEur(outflowsEntry.value)}</span>
        </p>
      )}
      {scenarioEntries.map((entry) => (
        <p key={entry.dataKey} className="text-sm flex justify-between gap-4">
          <span style={{ color: entry.color }}>{entry.name}</span>
          <span className="font-medium">{formatEur(entry.value)}</span>
        </p>
      ))}
    </div>
  )
}
