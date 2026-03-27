"use client"

import { useState } from "react"
import { PlayIcon, Loader2 } from "lucide-react"

import { useHealthChecks, useRunHealthCheck } from "@/features/reports/health-checks/hooks"
import { Button } from "@/shared/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs"
import { HealthCheckSummary } from "./health-check-summary"
import { IssueList } from "./issue-list"

type TabValue = "unresolved" | "all" | "critical" | "warning"

export function HealthChecksPageClient() {
  const [tab, setTab] = useState<TabValue>("unresolved")

  const resolvedFilter =
    tab === "unresolved" ? false :
    tab === "all" ? undefined :
    false

  const severityFilter =
    tab === "critical" ? "critical" :
    tab === "warning" ? "warning" :
    undefined

  const { data } = useHealthChecks({
    resolved: resolvedFilter,
    severity: severityFilter,
  })

  const runHealthCheck = useRunHealthCheck()

  const run = data?.run ?? null
  const issues = data?.issues ?? []

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {run
            ? `Posledná kontrola: ${new Date(run.created_at).toLocaleString("sk-SK")}`
            : "Žiadna kontrola nebola spustená"}
        </p>
        <Button
          onClick={() => runHealthCheck.mutate()}
          disabled={runHealthCheck.isPending}
        >
          {runHealthCheck.isPending ? (
            <Loader2 className="size-4 mr-1 animate-spin" />
          ) : (
            <PlayIcon className="size-4 mr-1" />
          )}
          Spustiť kontrolu
        </Button>
      </div>

      <HealthCheckSummary run={run} />

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="unresolved">Nevyriešené</TabsTrigger>
          <TabsTrigger value="critical">Kritické</TabsTrigger>
          <TabsTrigger value="warning">Varovania</TabsTrigger>
          <TabsTrigger value="all">Všetky</TabsTrigger>
        </TabsList>

        <TabsContent value={tab}>
          <IssueList issues={issues} />
        </TabsContent>
      </Tabs>
    </>
  )
}
