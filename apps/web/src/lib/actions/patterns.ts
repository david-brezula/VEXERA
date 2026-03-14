"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { detectRecurringPatterns } from "@/lib/services/pattern-detection.service"
import type { DetectedPattern } from "@/lib/services/pattern-detection.service"

export async function getDetectedPatternsAction(): Promise<DetectedPattern[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []
  return detectRecurringPatterns(supabase, orgId)
}

export async function dismissPatternAction(patternId: string): Promise<{ error?: string }> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const { data: org } = await supabase
    .from("organizations")
    .select("dismissed_recurring_patterns")
    .eq("id", orgId)
    .single()

  const current = ((org as any)?.dismissed_recurring_patterns ?? []) as string[]
  if (current.includes(patternId)) return {}

  const { error } = await (supabase.from("organizations" as any) as any)
    .update({ dismissed_recurring_patterns: [...current, patternId] })
    .eq("id", orgId)

  if (error) return { error: error.message }
  return {}
}

export async function getPatternCountAction(): Promise<number> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return 0
  const patterns = await detectRecurringPatterns(supabase, orgId)
  return patterns.length
}
