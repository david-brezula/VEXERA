"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"
import type { RuleCondition } from "@vexera/types"

export async function getAccountOptionsAction(): Promise<{ value: string; label: string }[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []

  const { data } = await supabase
    .from("chart_of_accounts")
    .select("account_number, account_name")
    .eq("organization_id", orgId)
    .order("account_number")

  return (data ?? []).map((a) => ({
    value: a.account_number,
    label: `${a.account_number} — ${a.account_name}`,
  }))
}

export async function getCategoryOptionsAction(): Promise<string[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []

  const { data } = await supabase
    .from("documents")
    .select("category")
    .eq("organization_id", orgId)
    .not("category", "is", null)

  const unique = [...new Set((data ?? []).map((d) => d.category as string))]
  return unique.sort()
}

export async function testRuleAction(rule: {
  target_entity: string
  conditions: RuleCondition[]
  logic_operator: string
  actions: { type: string; value: string }[]
}): Promise<{
  matches: { id: string; description: string; amount: number | null; date: string | null; actions: Record<string, string> }[]
  total: number
}> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { matches: [], total: 0 }

  const table = rule.target_entity === "document" ? "documents" : "bank_transactions"
  const { data } = await supabase
    .from(table)
    .select("*")
    .eq("organization_id", orgId)
    .limit(100)

  if (!data) return { matches: [], total: 0 }

  const { evaluateCondition } = await import("@/features/rules/service")

  const matches: { id: string; description: string; amount: number | null; date: string | null; actions: Record<string, string> }[] = []

  for (const entity of data) {
    const target: Record<string, string | number | null> = {}
    for (const key of Object.keys(entity)) {
      target[key] = (entity as Record<string, unknown>)[key] as string | number | null
    }

    const op = rule.logic_operator ?? "AND"
    const conditionsMet = op === "OR"
      ? rule.conditions.some((c) => evaluateCondition(c, target))
      : rule.conditions.every((c) => evaluateCondition(c, target))

    if (conditionsMet) {
      const actions: Record<string, string> = {}
      for (const action of rule.actions) {
        const colMap: Record<string, string> = {
          set_category: "category",
          set_account: "account_number",
          set_document_type: "document_type",
          set_tag: "tag",
        }
        const col = colMap[action.type]
        if (col) actions[col] = action.value
      }

      const e = entity as Record<string, unknown>
      matches.push({
        id: e.id as string,
        description: (e.description ?? e.name ?? "—") as string,
        amount: (e.total_amount ?? e.amount ?? null) as number | null,
        date: (e.issue_date ?? e.transaction_date ?? null) as string | null,
        actions,
      })
    }
  }

  return { matches, total: matches.length }
}
