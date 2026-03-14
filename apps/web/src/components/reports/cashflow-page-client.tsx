"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import {
  ArrowLeft,
  AlertTriangle,
  TrendingDown,
  TrendingUp,
  Trash2,
  Plus,
} from "lucide-react"
import { useQuery, useQueryClient } from "@tanstack/react-query"

import { useOrganization } from "@/providers/organization-provider"
import { queryKeys } from "@/lib/query-keys"
import { formatEur } from "@vexera/utils"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { CashflowAreaChart } from "@/components/charts/cashflow-area-chart"
import {
  listScenariosAction,
  createScenarioAction,
  deleteScenarioAction,
} from "@/lib/actions/cashflow"
import type { CashFlowSummary, CashFlowPoint } from "@/lib/data/cashflow"
import type { CashflowScenario, ScenarioAdjustment } from "@/lib/services/cashflow-scenarios.service"
import { applyScenarioAdjustments } from "@/lib/services/cashflow-scenarios.service"

// ─── Fetch helpers ──────────────────────────────────────────────────────────

interface ApiForecastPoint {
  date: string
  projected_balance: number
  inflows: number
  outflows: number
}

async function fetchCashflowData(orgId: string): Promise<{
  summary: CashFlowSummary
  forecast: CashFlowPoint[]
}> {
  const res = await fetch(`/api/cashflow?organization_id=${orgId}`)
  if (!res.ok) throw new Error("Failed to fetch cashflow data")
  const json = await res.json() as { summary: CashFlowSummary; forecast: ApiForecastPoint[] }
  return {
    summary: json.summary,
    forecast: json.forecast.map((p) => ({
      date: p.date,
      balance: p.projected_balance,
      inflows: p.inflows,
      outflows: p.outflows,
    })),
  }
}

// ─── Main component ─────────────────────────────────────────────────────────

export function CashflowPageClient() {
  const { activeOrg } = useOrganization()
  const orgId = activeOrg?.id ?? ""
  const queryClient = useQueryClient()

  // Fetch cashflow data
  const { data: cashflowData, isLoading: cashflowLoading } = useQuery({
    queryKey: ["cashflow", orgId],
    queryFn: () => fetchCashflowData(orgId),
    enabled: !!orgId,
  })

  // Fetch scenarios
  const { data: scenarios = [], isLoading: scenariosLoading } = useQuery({
    queryKey: queryKeys.cashflowScenarios.list(orgId),
    queryFn: () => listScenariosAction(),
    enabled: !!orgId,
  })

  const summary = cashflowData?.summary
  const forecast = cashflowData?.forecast ?? []

  // Build scenario lines for the chart
  const scenarioLines = scenarios.map((scenario) => {
    const baseForecast = forecast.map((p) => ({
      date: p.date,
      amount: p.inflows - p.outflows,
    }))
    const adjusted = applyScenarioAdjustments(baseForecast, scenario.adjustments)
    return {
      name: scenario.name,
      color: scenario.color,
      points: adjusted.map((p) => ({
        date: p.date,
        balance: p.scenarioAmount,
      })),
    }
  })

  // Weekly projection points
  const weeklyPoints = forecast.filter(
    (_, i) => i % 7 === 0 || i === forecast.length - 1
  )

  const isAtRisk = summary?.risk_date !== null && summary?.risk_date !== undefined
  const trend30d = summary ? summary.forecast_30d - summary.current_balance : 0
  const trendUp = trend30d >= 0

  if (cashflowLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid gap-4 md:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-[450px]" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/reports">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cashflow Forecast</h1>
          <p className="text-sm text-muted-foreground">
            90-day projection with scenario analysis
          </p>
        </div>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid gap-4 md:grid-cols-5">
          <SummaryCard
            title="Current Balance"
            value={formatEur(summary.current_balance)}
            subtitle="Bank accounts total"
          />
          <SummaryCard
            title="30-Day Forecast"
            value={formatEur(summary.forecast_30d)}
            trend={trend30d}
            trendUp={trendUp}
          />
          <SummaryCard
            title="60-Day Forecast"
            value={formatEur(summary.forecast_60d)}
          />
          <SummaryCard
            title="90-Day Forecast"
            value={formatEur(summary.forecast_90d)}
            isAtRisk={isAtRisk}
          />
          <Card className={isAtRisk ? "border-destructive" : ""}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Risk Date</CardTitle>
            </CardHeader>
            <CardContent>
              {isAtRisk ? (
                <>
                  <div className="text-2xl font-bold text-destructive">
                    {new Date(summary.risk_date!).toLocaleDateString("sk-SK")}
                  </div>
                  <div className="flex items-center gap-1 mt-1">
                    <AlertTriangle className="h-3 w-3 text-destructive" />
                    <span className="text-xs text-destructive">Balance goes negative</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="text-2xl font-bold text-green-600">None</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    No negative balance projected
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full-size chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Forecast Chart</CardTitle>
          <CardDescription className="text-xs">
            Projected balance with scenario overlays
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
            scenarios={scenarioLines.length > 0 ? scenarioLines : undefined}
            height={450}
          />
        </CardContent>
      </Card>

      {/* Scenario management */}
      <ScenarioManager
        scenarios={scenarios}
        isLoading={scenariosLoading}
        orgId={orgId}
        onMutate={() => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.cashflowScenarios.list(orgId),
          })
        }}
      />

      {/* Weekly projection table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">Weekly Projection</CardTitle>
          <CardDescription className="text-xs">
            Projected balance at weekly intervals
          </CardDescription>
        </CardHeader>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Inflows</TableHead>
              <TableHead className="text-right">Outflows</TableHead>
              <TableHead className="text-right">Balance</TableHead>
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
                    {point.inflows > 0 ? `+${formatEur(point.inflows)}` : "\u2014"}
                  </TableCell>
                  <TableCell className="text-right text-sm text-red-600 tabular-nums">
                    {point.outflows > 0 ? `-${formatEur(point.outflows)}` : "\u2014"}
                  </TableCell>
                  <TableCell
                    className={`text-right font-medium tabular-nums ${isNegative ? "text-destructive" : ""}`}
                  >
                    {formatEur(point.balance)}
                  </TableCell>
                  <TableCell className="w-10">
                    {isNegative && (
                      <Badge variant="destructive" className="text-xs">
                        Risk
                      </Badge>
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

// ─── Summary card ───────────────────────────────────────────────────────────

function SummaryCard({
  title,
  value,
  subtitle,
  trend,
  trendUp,
  isAtRisk,
}: {
  title: string
  value: string
  subtitle?: string
  trend?: number
  trendUp?: boolean
  isAtRisk?: boolean
}) {
  return (
    <Card className={isAtRisk ? "border-destructive" : ""}>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${isAtRisk ? "text-destructive" : ""}`}>
          {value}
        </div>
        {subtitle && (
          <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
        )}
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            {trendUp ? (
              <TrendingUp className="h-3 w-3 text-green-600" />
            ) : (
              <TrendingDown className="h-3 w-3 text-red-600" />
            )}
            <span
              className={`text-xs font-medium ${trendUp ? "text-green-600" : "text-red-600"}`}
            >
              {trendUp ? "+" : ""}
              {formatEur(trend)}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─── Scenario manager ───────────────────────────────────────────────────────

const SCENARIO_COLORS = [
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#0891b2",
  "#4f46e5",
]

function ScenarioManager({
  scenarios,
  isLoading,
  orgId,
  onMutate,
}: {
  scenarios: CashflowScenario[]
  isLoading: boolean
  orgId: string
  onMutate: () => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()

  // Form state
  const [name, setName] = useState("")
  const [color, setColor] = useState(SCENARIO_COLORS[0])
  const [adjType, setAdjType] = useState<ScenarioAdjustment["type"]>("add_inflow")
  const [amount, setAmount] = useState("")
  const [description, setDescription] = useState("")

  function handleCreate() {
    if (!name.trim()) return

    const adjustment: ScenarioAdjustment = {
      type: adjType,
      amount: parseFloat(amount) || 0,
      description: description || undefined,
    }

    startTransition(async () => {
      const result = await createScenarioAction({
        name: name.trim(),
        color,
        adjustments: [adjustment],
        description: description || undefined,
      })
      if (!result.error) {
        setName("")
        setAmount("")
        setDescription("")
        setShowForm(false)
        onMutate()
      }
    })
  }

  function handleDelete(scenarioId: string) {
    startTransition(async () => {
      await deleteScenarioAction(scenarioId)
      onMutate()
    })
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm font-semibold">Scenarios</CardTitle>
            <CardDescription className="text-xs">
              What-if scenarios to model different cashflow outcomes
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(!showForm)}
            className="gap-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Scenario
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add scenario form */}
        {showForm && (
          <div className="rounded-lg border p-4 space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="scenario-name" className="text-xs">
                  Name
                </Label>
                <Input
                  id="scenario-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. New client contract"
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scenario-color" className="text-xs">
                  Color
                </Label>
                <div className="flex gap-1.5">
                  {SCENARIO_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`h-8 w-8 rounded-md border-2 transition-colors ${
                        color === c ? "border-foreground" : "border-transparent"
                      }`}
                      style={{ backgroundColor: c }}
                      onClick={() => setColor(c)}
                    />
                  ))}
                </div>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="scenario-type" className="text-xs">
                  Adjustment Type
                </Label>
                <Select
                  value={adjType}
                  onValueChange={(v) => setAdjType(v as ScenarioAdjustment["type"])}
                >
                  <SelectTrigger id="scenario-type" className="h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="add_inflow">Add Inflow</SelectItem>
                    <SelectItem value="add_outflow">Add Outflow</SelectItem>
                    <SelectItem value="delay_payment">Delay Payment</SelectItem>
                    <SelectItem value="remove_item">Remove Item</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="scenario-amount" className="text-xs">
                  Amount (EUR)
                </Label>
                <Input
                  id="scenario-amount"
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="scenario-desc" className="text-xs">
                Description
              </Label>
              <Input
                id="scenario-desc"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="h-8 text-sm"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={isPending || !name.trim()}
              >
                {isPending ? "Creating..." : "Create Scenario"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Scenarios list */}
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : scenarios.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No scenarios created yet. Add one to model different outcomes.
          </p>
        ) : (
          <div className="space-y-2">
            {scenarios.map((scenario) => (
              <div
                key={scenario.id}
                className="flex items-center justify-between rounded-lg border px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div
                    className="h-3 w-3 rounded-full flex-shrink-0"
                    style={{ backgroundColor: scenario.color }}
                  />
                  <div>
                    <p className="text-sm font-medium">{scenario.name}</p>
                    {scenario.description && (
                      <p className="text-xs text-muted-foreground">
                        {scenario.description}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="text-xs">
                    {scenario.adjustments.length} adjustment
                    {scenario.adjustments.length !== 1 ? "s" : ""}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => handleDelete(scenario.id)}
                    disabled={isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
