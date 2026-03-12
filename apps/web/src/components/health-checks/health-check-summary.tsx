"use client"

import { AlertTriangle, AlertCircle, Info, CheckCircle2 } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { HealthCheckRun } from "@/hooks/use-health-checks"

interface HealthCheckSummaryProps {
  run: HealthCheckRun | null
}

export function HealthCheckSummary({ run }: HealthCheckSummaryProps) {
  if (!run) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Zatiaľ nebola spustená žiadna kontrola. Kliknite na &quot;Spustiť kontrolu&quot;.
        </CardContent>
      </Card>
    )
  }

  const items = [
    {
      label: "Kritické",
      count: run.critical_count,
      icon: AlertCircle,
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      label: "Varovania",
      count: run.warning_count,
      icon: AlertTriangle,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10",
    },
    {
      label: "Informácie",
      count: run.info_count,
      icon: Info,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      label: "Celkovo",
      count: run.total_issues,
      icon: run.total_issues === 0 ? CheckCircle2 : AlertTriangle,
      color: run.total_issues === 0 ? "text-green-500" : "text-muted-foreground",
      bg: run.total_issues === 0 ? "bg-green-500/10" : "bg-muted/50",
    },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">{item.label}</CardTitle>
            <div className={`rounded-full p-2 ${item.bg}`}>
              <item.icon className={`size-4 ${item.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${item.color}`}>{item.count}</div>
            {run.completed_at && (
              <p className="text-xs text-muted-foreground mt-1">
                {new Date(run.completed_at).toLocaleString("sk-SK")}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
