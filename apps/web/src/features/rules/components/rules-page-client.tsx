"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { useRules } from "../hooks"
import { Button } from "@/shared/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/shared/components/ui/tabs"
import { RulesTable } from "./rules-table"
import { RuleFormDialog } from "./rule-form-dialog"
import type { RuleTargetEntity } from "@vexera/types"

type TabValue = "all" | "document" | "bank_transaction"

export function RulesPageClient() {
  const [tab, setTab] = useState<TabValue>("all")
  const [createOpen, setCreateOpen] = useState(false)

  const targetEntity: RuleTargetEntity | undefined =
    tab === "all" ? undefined : tab

  const { data: rules = [] } = useRules({
    target_entity: targetEntity,
    active_only: false,
  })

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {rules.length} {rules.length === 1 ? "pravidlo" : "pravidiel"}
        </p>
        <Button onClick={() => setCreateOpen(true)}>
          <PlusIcon className="size-4 mr-1" />
          Nové pravidlo
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList>
          <TabsTrigger value="all">Všetky</TabsTrigger>
          <TabsTrigger value="document">Doklady</TabsTrigger>
          <TabsTrigger value="bank_transaction">Transakcie</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <RulesTable targetEntity={undefined} />
        </TabsContent>
        <TabsContent value="document">
          <RulesTable targetEntity="document" />
        </TabsContent>
        <TabsContent value="bank_transaction">
          <RulesTable targetEntity="bank_transaction" />
        </TabsContent>
      </Tabs>

      <RuleFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
      />
    </>
  )
}
