/**
 * Cashflow Scenarios Service
 *
 * CRUD for what-if scenarios that adjust the base cashflow forecast.
 * Supports: add_inflow, add_outflow, delay_payment, remove_item.
 *
 * Usage:
 *   const scenarios = await listScenarios(supabase, orgId)
 *   const forecast = await forecastWithScenario(supabase, orgId, scenarioId, days)
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ScenarioAdjustment {
  type: "add_inflow" | "add_outflow" | "delay_payment" | "remove_item"
  amount?: number
  days?: number
  description?: string
  date?: string
}

export interface CashflowScenario {
  id: string
  organization_id: string
  user_id: string
  name: string
  description: string | null
  color: string
  adjustments: ScenarioAdjustment[]
  created_at: string
  updated_at: string
}

export interface CreateScenarioInput {
  name: string
  description?: string | null
  color?: string
  adjustments: ScenarioAdjustment[]
}

export interface ScenarioForecastPoint {
  date: string
  baseAmount: number
  scenarioAmount: number
  difference: number
}

// ─── CRUD ───────────────────────────────────────────────────────────────────

export async function listScenarios(
  supabase: SupabaseClient,
  organizationId: string
): Promise<CashflowScenario[]> {
  const { data, error } = await supabase
    .from("cashflow_scenarios")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })

  if (error) return []
  return (data ?? []) as CashflowScenario[]
}

export async function createScenario(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  input: CreateScenarioInput
): Promise<CashflowScenario> {
  const { data, error } = await supabase.from("cashflow_scenarios")
    .insert({
      organization_id: organizationId,
      user_id: userId,
      name: input.name,
      description: input.description ?? null,
      color: input.color ?? "#2563eb",
      adjustments: input.adjustments,
    })
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to create scenario: ${error?.message ?? "unknown error"}`)
  }

  return data as CashflowScenario
}

export async function updateScenario(
  supabase: SupabaseClient,
  scenarioId: string,
  input: Partial<CreateScenarioInput>
): Promise<CashflowScenario> {
  const { data, error } = await supabase.from("cashflow_scenarios")
    .update(input)
    .eq("id", scenarioId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to update scenario: ${error?.message ?? "unknown error"}`)
  }

  return data as CashflowScenario
}

export async function deleteScenario(
  supabase: SupabaseClient,
  scenarioId: string
): Promise<void> {
  const { error } = await supabase.from("cashflow_scenarios")
    .delete()
    .eq("id", scenarioId)

  if (error) {
    throw new Error(`Failed to delete scenario: ${error.message}`)
  }
}

// ─── Forecast with Scenario ─────────────────────────────────────────────────

/**
 * Apply scenario adjustments to the base forecast.
 * Returns point-by-point comparison of base vs scenario.
 */
export function applyScenarioAdjustments(
  baseForecast: Array<{ date: string; amount: number }>,
  adjustments: ScenarioAdjustment[]
): ScenarioForecastPoint[] {
  // Clone base forecast
  const dateAmounts = new Map<string, number>()
  for (const point of baseForecast) {
    dateAmounts.set(point.date, point.amount)
  }

  // Apply adjustments
  for (const adj of adjustments) {
    switch (adj.type) {
      case "add_inflow": {
        const date = adj.date ?? baseForecast[0]?.date ?? ""
        if (date && dateAmounts.has(date)) {
          dateAmounts.set(date, (dateAmounts.get(date) ?? 0) + (adj.amount ?? 0))
        }
        break
      }
      case "add_outflow": {
        const date = adj.date ?? baseForecast[0]?.date ?? ""
        if (date && dateAmounts.has(date)) {
          dateAmounts.set(date, (dateAmounts.get(date) ?? 0) - (adj.amount ?? 0))
        }
        break
      }
      case "delay_payment": {
        // Move amount from original date to delayed date
        if (adj.date && adj.days) {
          const origAmount = dateAmounts.get(adj.date) ?? 0
          const delayed = new Date(adj.date)
          delayed.setDate(delayed.getDate() + adj.days)
          const delayedDate = delayed.toISOString().split("T")[0]

          if (dateAmounts.has(adj.date)) {
            dateAmounts.set(adj.date, origAmount + (adj.amount ?? 0))
          }
          if (dateAmounts.has(delayedDate)) {
            dateAmounts.set(delayedDate, (dateAmounts.get(delayedDate) ?? 0) - (adj.amount ?? 0))
          }
        }
        break
      }
      case "remove_item": {
        // Remove a known amount from a date
        if (adj.date && adj.amount) {
          const current = dateAmounts.get(adj.date) ?? 0
          dateAmounts.set(adj.date, current + adj.amount)
        }
        break
      }
    }
  }

  // Build comparison, accumulating running totals
  let baseRunning = 0
  let scenarioRunning = 0

  return baseForecast.map((point) => {
    baseRunning += point.amount
    scenarioRunning += dateAmounts.get(point.date) ?? point.amount

    return {
      date: point.date,
      baseAmount: Number(baseRunning.toFixed(2)),
      scenarioAmount: Number(scenarioRunning.toFixed(2)),
      difference: Number((scenarioRunning - baseRunning).toFixed(2)),
    }
  })
}

/**
 * Compare multiple scenarios against the base forecast.
 */
export function compareScenarios(
  baseForecast: Array<{ date: string; amount: number }>,
  scenarios: Array<{ name: string; color: string; adjustments: ScenarioAdjustment[] }>
): Array<{
  name: string
  color: string
  points: ScenarioForecastPoint[]
  finalDifference: number
}> {
  return scenarios.map((scenario) => {
    const points = applyScenarioAdjustments(baseForecast, scenario.adjustments)
    const lastPoint = points[points.length - 1]
    return {
      name: scenario.name,
      color: scenario.color,
      points,
      finalDifference: lastPoint?.difference ?? 0,
    }
  })
}
