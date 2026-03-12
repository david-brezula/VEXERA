"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { getAccountBalances, type AccountBalance } from "@/lib/data/ledger"
import { writeAuditLog } from "@/lib/services/audit.server"

// ─── fetchBalancesAction ─────────────────────────────────────────────────────

export async function fetchBalancesAction(
  year?: number,
  month?: number
): Promise<AccountBalance[]> {
  return getAccountBalances(year, month)
}

// ─── createLedgerEntryAction ──────────────────────────────────────────────────

export async function createLedgerEntryAction(data: {
  entry_date: string
  description: string
  reference_number?: string
  debit_account_number: string
  credit_account_number: string
  debit_account_id?: string
  credit_account_id?: string
  amount: number
  currency?: string
  invoice_id?: string
  document_id?: string
  is_closing_entry?: boolean
}): Promise<{ error?: string; id?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: entry, error } = await (supabase.from("ledger_entries" as any) as any)
      .insert({
        organization_id: orgId,
        entry_date: data.entry_date,
        description: data.description,
        reference_number: data.reference_number ?? null,
        debit_account_number: data.debit_account_number,
        credit_account_number: data.credit_account_number,
        debit_account_id: data.debit_account_id ?? null,
        credit_account_id: data.credit_account_id ?? null,
        amount: data.amount,
        currency: data.currency ?? "EUR",
        status: "draft",
        is_closing_entry: data.is_closing_entry ?? false,
        invoice_id: data.invoice_id ?? null,
        document_id: data.document_id ?? null,
        created_by: user.id,
      })
      .select("id")
      .single()

    if (error) return { error: error.message }

    const entryId = (entry as unknown as { id: string })?.id

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "LEDGER_ENTRY_CREATED",
      entityType: "ledger_entry",
      entityId: entryId,
      newData: {
        description: data.description,
        debit_account_number: data.debit_account_number,
        credit_account_number: data.credit_account_number,
        amount: data.amount,
      },
    })

    revalidatePath("/ledger")
    return { id: entryId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── postLedgerEntryAction ────────────────────────────────────────────────────

export async function postLedgerEntryAction(
  entryId: string
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    // Verify entry exists and is draft
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchError } = await (supabase.from("ledger_entries" as any) as any)
      .select("id, status")
      .eq("id", entryId)
      .eq("organization_id", orgId)
      .single()

    if (fetchError || !existing) return { error: "Ledger entry not found" }

    const entry = existing as unknown as { id: string; status: string }
    if (entry.status !== "draft") {
      return { error: `Cannot post entry with status "${entry.status}"` }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("ledger_entries" as any) as any)
      .update({
        status: "posted",
        posted_by: user.id,
        posted_at: new Date().toISOString(),
      })
      .eq("id", entryId)
      .eq("organization_id", orgId)

    if (error) return { error: error.message }

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "LEDGER_ENTRY_POSTED",
      entityType: "ledger_entry",
      entityId: entryId,
      oldData: { status: "draft" },
      newData: { status: "posted" },
    })

    revalidatePath("/ledger")
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── reverseLedgerEntryAction ─────────────────────────────────────────────────

export async function reverseLedgerEntryAction(
  entryId: string
): Promise<{ error?: string; reversalId?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    // Fetch original entry
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchError } = await (supabase.from("ledger_entries" as any) as any)
      .select("id, status, entry_date, description, debit_account_number, credit_account_number, debit_account_id, credit_account_id, amount, currency, invoice_id, document_id, is_closing_entry")
      .eq("id", entryId)
      .eq("organization_id", orgId)
      .single()

    if (fetchError || !existing) return { error: "Ledger entry not found" }

    const original = existing as unknown as {
      id: string
      status: string
      entry_date: string
      description: string
      debit_account_number: string
      credit_account_number: string
      debit_account_id: string | null
      credit_account_id: string | null
      amount: number
      currency: string
      invoice_id: string | null
      document_id: string | null
      is_closing_entry: boolean
    }

    if (original.status !== "posted") {
      return { error: `Cannot reverse entry with status "${original.status}"` }
    }

    // Create reversal entry (swap debit/credit)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: reversal, error: insertError } = await (supabase.from("ledger_entries" as any) as any)
      .insert({
        organization_id: orgId,
        entry_date: new Date().toISOString().split("T")[0],
        description: `Reversal: ${original.description}`,
        debit_account_number: original.credit_account_number,
        credit_account_number: original.debit_account_number,
        debit_account_id: original.credit_account_id,
        credit_account_id: original.debit_account_id,
        amount: original.amount,
        currency: original.currency,
        status: "posted",
        is_closing_entry: original.is_closing_entry,
        invoice_id: original.invoice_id,
        document_id: original.document_id,
        created_by: user.id,
        posted_by: user.id,
        posted_at: new Date().toISOString(),
      })
      .select("id")
      .single()

    if (insertError) return { error: insertError.message }

    const reversalId = (reversal as unknown as { id: string })?.id

    // Mark original as reversed
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: updateError } = await (supabase.from("ledger_entries" as any) as any)
      .update({
        status: "reversed",
        reversed_by: reversalId,
      })
      .eq("id", entryId)
      .eq("organization_id", orgId)

    if (updateError) return { error: updateError.message }

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "LEDGER_ENTRY_REVERSED",
      entityType: "ledger_entry",
      entityId: entryId,
      oldData: { status: "posted" },
      newData: { status: "reversed", reversed_by: reversalId },
    })

    revalidatePath("/ledger")
    return { reversalId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── deleteLedgerEntryAction ──────────────────────────────────────────────────

export async function deleteLedgerEntryAction(
  entryId: string
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    // Only allow deleting draft entries
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: existing, error: fetchError } = await (supabase.from("ledger_entries" as any) as any)
      .select("id, status, description")
      .eq("id", entryId)
      .eq("organization_id", orgId)
      .single()

    if (fetchError || !existing) return { error: "Ledger entry not found" }

    const entry = existing as unknown as { id: string; status: string; description: string }
    if (entry.status !== "draft") {
      return { error: "Only draft entries can be deleted" }
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("ledger_entries" as any) as any)
      .delete()
      .eq("id", entryId)
      .eq("organization_id", orgId)

    if (error) return { error: error.message }

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "LEDGER_ENTRY_DELETED",
      entityType: "ledger_entry",
      entityId: entryId,
      oldData: { description: entry.description },
    })

    revalidatePath("/ledger")
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── batchPostEntriesAction ───────────────────────────────────────────────────

export async function batchPostEntriesAction(
  entryIds: string[]
): Promise<{ error?: string; postedCount?: number }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    // Fetch only draft entries from the provided IDs
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: draftsRaw, error: fetchError } = await (supabase.from("ledger_entries" as any) as any)
      .select("id, status")
      .eq("organization_id", orgId)
      .in("id", entryIds)
      .eq("status", "draft")

    if (fetchError) return { error: fetchError.message }
    if (!draftsRaw || draftsRaw.length === 0)
      return { error: "No eligible draft entries to post" }

    const drafts = draftsRaw as unknown as Array<{ id: string; status: string }>
    const eligibleIds = drafts.map((d) => d.id)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("ledger_entries" as any) as any)
      .update({
        status: "posted",
        posted_by: user.id,
        posted_at: new Date().toISOString(),
      })
      .in("id", eligibleIds)
      .eq("organization_id", orgId)

    if (error) return { error: error.message }

    // Audit each entry
    for (const draft of drafts) {
      await writeAuditLog(supabase, {
        organizationId: orgId,
        userId: user.id,
        action: "LEDGER_ENTRY_POSTED",
        entityType: "ledger_entry",
        entityId: draft.id,
        oldData: { status: "draft" },
        newData: { status: "posted" },
      })
    }

    revalidatePath("/ledger")
    return { postedCount: eligibleIds.length }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}
