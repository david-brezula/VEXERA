"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { writeAuditLog } from "@/lib/services/audit.server"

// ─── helpers ─────────────────────────────────────────────────────────────────

function deriveAccountClass(accountNumber: string): string {
  const firstDigit = accountNumber.charAt(0)
  const classMap: Record<string, string> = {
    "0": "long_term_assets",
    "1": "inventories",
    "2": "financial_accounts",
    "3": "receivables_payables",
    "4": "capital_liabilities",
    "5": "expenses",
    "6": "revenue",
    "7": "closing_off_balance",
    "8": "internal",
    "9": "off_balance",
  }
  return classMap[firstDigit] ?? "other"
}

// ─── createAccountAction ─────────────────────────────────────────────────────

export async function createAccountAction(data: {
  account_number: string
  account_name: string
  account_type: string
  parent_id?: string
  notes?: string
}): Promise<{ error?: string; id?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    if (!data.account_number || !data.account_name || !data.account_type) {
      return { error: "Account number, name, and type are required" }
    }

    const accountClass = deriveAccountClass(data.account_number)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: account, error } = await (supabase.from("chart_of_accounts" as any) as any)
      .insert({
        organization_id: orgId,
        account_number: data.account_number,
        account_name: data.account_name,
        account_class: accountClass,
        account_type: data.account_type,
        parent_id: data.parent_id ?? null,
        notes: data.notes ?? null,
        is_active: true,
        is_system: false,
      })
      .select("id")
      .single()

    if (error) return { error: error.message }

    const accountId = (account as unknown as { id: string })?.id

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "COA_ACCOUNT_CREATED",
      entityType: "chart_of_accounts",
      entityId: accountId,
      newData: {
        account_number: data.account_number,
        account_name: data.account_name,
        account_type: data.account_type,
      },
    })

    revalidatePath("/ledger")
    return { id: accountId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── updateAccountAction ─────────────────────────────────────────────────────

export async function updateAccountAction(
  accountId: string,
  data: {
    account_name: string
    account_type: string
    notes?: string
  }
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    // Verify account exists and is not system
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchError } = await (supabase.from("chart_of_accounts" as any) as any)
      .select("id, is_system, account_name, account_type")
      .eq("id", accountId)
      .single()

    if (fetchError || !existing) return { error: "Account not found" }

    const acc = existing as unknown as { id: string; is_system: boolean; account_name: string; account_type: string }
    if (acc.is_system) {
      return { error: "Cannot edit system accounts" }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("chart_of_accounts" as any) as any)
      .update({
        account_name: data.account_name,
        account_type: data.account_type,
        notes: data.notes ?? null,
      })
      .eq("id", accountId)

    if (error) return { error: error.message }

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "COA_ACCOUNT_UPDATED",
      entityType: "chart_of_accounts",
      entityId: accountId,
      oldData: { account_name: acc.account_name, account_type: acc.account_type },
      newData: { account_name: data.account_name, account_type: data.account_type },
    })

    revalidatePath("/ledger")
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── toggleAccountActiveAction ───────────────────────────────────────────────

export async function toggleAccountActiveAction(
  accountId: string
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    // Fetch account
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchError } = await (supabase.from("chart_of_accounts" as any) as any)
      .select("id, is_system, is_active, account_number")
      .eq("id", accountId)
      .single()

    if (fetchError || !existing) return { error: "Account not found" }

    const acc = existing as unknown as {
      id: string
      is_system: boolean
      is_active: boolean
      account_number: string
    }

    if (acc.is_system) {
      return { error: "Cannot toggle system accounts" }
    }

    // If deactivating, check no ledger entries reference this account
    if (acc.is_active) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { count, error: countError } = await (supabase.from("ledger_entries" as any) as any)
        .select("id", { count: "exact", head: true })
        .eq("account_number_new", acc.account_number)

      if (countError) return { error: countError.message }
      if ((count ?? 0) > 0) {
        return {
          error: `Cannot deactivate account ${acc.account_number}: ${count} ledger entries reference it`,
        }
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("chart_of_accounts" as any) as any)
      .update({ is_active: !acc.is_active })
      .eq("id", accountId)

    if (error) return { error: error.message }

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "COA_ACCOUNT_TOGGLED",
      entityType: "chart_of_accounts",
      entityId: accountId,
      oldData: { is_active: acc.is_active },
      newData: { is_active: !acc.is_active },
    })

    revalidatePath("/ledger")
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}
