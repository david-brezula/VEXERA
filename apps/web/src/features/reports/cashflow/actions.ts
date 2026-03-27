"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"
import {
  createScenario,
  deleteScenario,
  listScenarios,
} from "@/features/reports/cashflow/scenarios.service"
import type {
  CashflowScenario,
  CreateScenarioInput,
} from "@/features/reports/cashflow/scenarios.service"

export async function listScenariosAction(): Promise<CashflowScenario[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []
  return listScenarios(supabase, orgId)
}

export async function createScenarioAction(
  input: CreateScenarioInput
): Promise<{ data?: CashflowScenario; error?: string }> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  try {
    const scenario = await createScenario(supabase, orgId, user.id, input)
    return { data: scenario }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" }
  }
}

export async function deleteScenarioAction(
  scenarioId: string
): Promise<{ error?: string }> {
  const supabase = await createClient()

  try {
    await deleteScenario(supabase, scenarioId)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unknown error" }
  }
}
