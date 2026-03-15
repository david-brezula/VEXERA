import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "./org"

// ─── Types ────────────────────────────────────────────────────────────────────

export type FiscalPeriod = {
  id: string
  org_id: string
  year: number
  month: number
  status: "open" | "locked"
  locked_at: string | null
  locked_by: string | null
  created_at: string
}

// ─── getFiscalPeriods ─────────────────────────────────────────────────────────

export async function getFiscalPeriods(year: number): Promise<FiscalPeriod[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("fiscal_periods" as any) as any)
    .select("id, org_id, year, month, status, locked_at, locked_by, created_at")
    .eq("org_id", orgId)
    .eq("year", year)
    .order("month", { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as FiscalPeriod[]
}
