"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"
import { writeAuditLog } from "@/shared/services/audit.server"

// ─── lockPeriodAction ────────────────────────────────────────────────────────

export async function lockPeriodAction(
  year: number,
  month: number
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    // Check no draft journal entries exist in this period
    const { count, error: countError } = await supabase.from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("period_year", year)
      .eq("period_month", month)
      .eq("status", "draft")

    if (countError) return { error: countError.message }
    if ((count ?? 0) > 0) {
      return {
        error: `Cannot lock period ${year}-${String(month).padStart(2, "0")}: ${count} draft journal entries exist. Post or delete them first.`,
      }
    }

    // Upsert fiscal period to locked
    const { error } = await supabase.from("fiscal_periods")
      .upsert(
        {
          organization_id: orgId,
          year,
          month,
          status: "locked",
          locked_at: new Date().toISOString(),
          locked_by: user.id,
        },
        { onConflict: "organization_id,year,month" }
      )

    if (error) return { error: error.message }

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "FISCAL_PERIOD_LOCKED",
      entityType: "fiscal_period",
      newData: { year, month },
    })

    revalidatePath("/ledger")
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── unlockPeriodAction ──────────────────────────────────────────────────────

export async function unlockPeriodAction(
  year: number,
  month: number
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    // Only allow unlocking the most recently locked period for this org
    const { data: lockedPeriods, error: fetchError } = await supabase.from("fiscal_periods")
      .select("year, month, locked_at")
      .eq("organization_id", orgId)
      .eq("status", "locked")
      .order("locked_at", { ascending: false })
      .limit(1)

    if (fetchError) return { error: fetchError.message }

    const mostRecent = lockedPeriods?.[0]
    if (!mostRecent || mostRecent.year !== year || mostRecent.month !== month) {
      return {
        error: `Can only unlock the most recently locked period. Expected ${mostRecent?.year}-${String(mostRecent?.month ?? 0).padStart(2, "0")}, got ${year}-${String(month).padStart(2, "0")}`,
      }
    }

    const { error } = await supabase.from("fiscal_periods")
      .update({
        status: "open",
        locked_at: null,
        locked_by: null,
      })
      .eq("organization_id", orgId)
      .eq("year", year)
      .eq("month", month)

    if (error) return { error: error.message }

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "FISCAL_PERIOD_UNLOCKED",
      entityType: "fiscal_period",
      newData: { year, month },
    })

    revalidatePath("/ledger")
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── lockQuarterAction ───────────────────────────────────────────────────────

export async function lockQuarterAction(
  year: number,
  quarter: 1 | 2 | 3 | 4
): Promise<{ error?: string }> {
  const startMonth = (quarter - 1) * 3 + 1
  const months = [startMonth, startMonth + 1, startMonth + 2]

  for (const month of months) {
    const result = await lockPeriodAction(year, month)
    if (result.error) {
      return { error: `Failed to lock month ${month}: ${result.error}` }
    }
  }

  return {}
}
