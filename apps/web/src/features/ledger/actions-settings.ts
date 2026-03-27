"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"
import { getLedgerSettings, type LedgerSettings } from "./data-settings"
import { writeAuditLog } from "@/shared/services/audit.server"

// ─── getLedgerSettingsAction ─────────────────────────────────────────────────

export async function getLedgerSettingsAction(): Promise<LedgerSettings> {
  return getLedgerSettings()
}

// ─── updateLedgerSettingsAction ──────────────────────────────────────────────

export async function updateLedgerSettingsAction(
  settings: Omit<LedgerSettings, "org_id">
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    // Fetch old settings for audit diff
    const oldSettings = await getLedgerSettings()

    const { error } = await supabase.from("organization_ledger_settings")
      .upsert(
        {
          org_id: orgId,
          ...settings,
        },
        { onConflict: "org_id" }
      )

    if (error) return { error: error.message }

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "LEDGER_SETTINGS_UPDATED",
      entityType: "organization",
      entityId: orgId,
      oldData: oldSettings as unknown as Record<string, unknown>,
      newData: settings as unknown as Record<string, unknown>,
    })

    revalidatePath("/ledger")
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}
