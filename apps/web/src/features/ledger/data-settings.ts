import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"

// ─── Types ────────────────────────────────────────────────────────────────────

export type LedgerSettings = {
  organization_id: string
  default_receivable_account: string
  default_payable_account: string
  default_revenue_account: string
  default_expense_account: string
  default_vat_output_account: string
  default_vat_input_account: string
  default_bank_account: string
}

// Slovak standard chart of accounts defaults
const DEFAULT_LEDGER_SETTINGS: Omit<LedgerSettings, "organization_id"> = {
  default_receivable_account: "311",
  default_payable_account: "321",
  default_revenue_account: "602",
  default_expense_account: "501",
  default_vat_output_account: "343100",
  default_vat_input_account: "343200",
  default_bank_account: "221",
}

// ─── getLedgerSettings ────────────────────────────────────────────────────────

export async function getLedgerSettings(): Promise<LedgerSettings> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { organization_id: "", ...DEFAULT_LEDGER_SETTINGS }

  const { data, error } = await supabase.from("organization_ledger_settings")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle()

  if (error) throw error

  if (!data) {
    return { organization_id: orgId, ...DEFAULT_LEDGER_SETTINGS }
  }

  return data as unknown as LedgerSettings
}
