"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"
import { getAccountBalances, type AccountBalance } from "./data"
import { writeAuditLog } from "@/shared/services/audit.server"

// ─── fetchBalancesAction ─────────────────────────────────────────────────────

export async function fetchBalancesAction(
  year?: number,
  month?: number
): Promise<AccountBalance[]> {
  return getAccountBalances(year, month)
}

// ─── helpers ─────────────────────────────────────────────────────────────────

async function checkPeriodNotLocked(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  orgId: string,
  entryDate: string
): Promise<string | null> {
  const date = new Date(entryDate)
  const year = date.getFullYear()
  const month = date.getMonth() + 1

  const { data, error } = await supabase.from("fiscal_periods")
    .select("status")
    .eq("organization_id", orgId)
    .eq("year", year)
    .eq("month", month)
    .maybeSingle()

  if (error) return error.message

  const period = data
  if (period?.status === "locked") {
    return `Fiscal period ${year}-${String(month).padStart(2, "0")} is locked`
  }
  return null
}

async function generateEntryNumber(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  orgId: string,
  year: number
): Promise<string> {
  const { count, error } = await supabase.from("journal_entries")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", orgId)
    .eq("period_year", year)

  if (error) throw error

  const nextNum = (count ?? 0) + 1
  return `JE-${year}-${String(nextNum).padStart(4, "0")}`
}

// ─── createJournalEntryAction ────────────────────────────────────────────────

export async function createJournalEntryAction(data: {
  entry_date: string
  description: string
  reference_number?: string
  invoice_id?: string
  document_id?: string
  is_closing_entry?: boolean
  lines: { account_number: string; debit_amount: number; credit_amount: number }[]
}): Promise<{ error?: string; id?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    // Validate: at least 2 lines
    if (!data.lines || data.lines.length < 2) {
      return { error: "Journal entry must have at least 2 lines" }
    }

    // Validate: sum(debits) === sum(credits)
    const totalDebits = data.lines.reduce((sum, l) => sum + (Number(l.debit_amount) || 0), 0)
    const totalCredits = data.lines.reduce((sum, l) => sum + (Number(l.credit_amount) || 0), 0)
    if (Math.abs(totalDebits - totalCredits) > 0.005) {
      return { error: `Debits (${totalDebits.toFixed(2)}) must equal credits (${totalCredits.toFixed(2)})` }
    }

    // Check fiscal period not locked
    const lockError = await checkPeriodNotLocked(supabase, orgId, data.entry_date)
    if (lockError) return { error: lockError }

    const entryDate = new Date(data.entry_date)
    const periodYear = entryDate.getFullYear()
    const periodMonth = entryDate.getMonth() + 1

    // Generate entry number
    const entryNumber = await generateEntryNumber(supabase, orgId, periodYear)

    // Insert journal entry
    const { data: entry, error } = await supabase.from("journal_entries")
      .insert({
        organization_id: orgId,
        entry_number: entryNumber,
        entry_date: data.entry_date,
        period_year: periodYear,
        period_month: periodMonth,
        description: data.description,
        reference_number: data.reference_number ?? null,
        invoice_id: data.invoice_id ?? null,
        document_id: data.document_id ?? null,
        status: "draft",
        is_closing_entry: data.is_closing_entry ?? false,
        created_by: user.id,
      })
      .select("id")
      .single()

    if (error) return { error: error.message }

    const entryId = entry?.id

    // Insert ledger entry lines
    const lineInserts = data.lines.map((line) => ({
      journal_entry_id: entryId,
      organization_id: orgId,
      entry_date: data.entry_date,
      period_year: periodYear,
      period_month: periodMonth,
      description: data.description,
      debit_account_number: line.debit_amount > 0 ? line.account_number : "",
      credit_account_number: line.credit_amount > 0 ? line.account_number : "",
      account_number_new: line.account_number,
      amount: line.debit_amount > 0 ? line.debit_amount : line.credit_amount,
      debit_amount: line.debit_amount,
      credit_amount: line.credit_amount,
    }))

    const { error: linesError } = await supabase.from("ledger_entries")
      .insert(lineInserts)

    if (linesError) return { error: linesError.message }

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "JOURNAL_ENTRY_CREATED",
      entityType: "journal_entry",
      entityId: entryId,
      newData: {
        entry_number: entryNumber,
        description: data.description,
        total_amount: totalDebits,
        line_count: data.lines.length,
      },
    })

    revalidatePath("/ledger")
    return { id: entryId }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── postJournalEntryAction ──────────────────────────────────────────────────

export async function postJournalEntryAction(
  entryId: string
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    // Fetch journal entry
    const { data: existing, error: fetchError } = await supabase.from("journal_entries")
      .select("id, status, entry_date")
      .eq("id", entryId)
      .eq("organization_id", orgId)
      .single()

    if (fetchError || !existing) return { error: "Journal entry not found" }

    const entry = existing
    if (entry.status !== "draft") {
      return { error: `Cannot post entry with status "${entry.status}"` }
    }

    // Check fiscal period not locked
    const lockError = await checkPeriodNotLocked(supabase, orgId, entry.entry_date)
    if (lockError) return { error: lockError }

    const { error } = await supabase.from("journal_entries")
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
      action: "JOURNAL_ENTRY_POSTED",
      entityType: "journal_entry",
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

// ─── reverseJournalEntryAction ───────────────────────────────────────────────

export async function reverseJournalEntryAction(
  entryId: string
): Promise<{ error?: string; reversalId?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    // Fetch original journal entry
    const { data: existing, error: fetchError } = await supabase.from("journal_entries")
      .select("id, status, entry_date, description, reference_number, invoice_id, document_id, is_closing_entry, period_year, period_month")
      .eq("id", entryId)
      .eq("organization_id", orgId)
      .single()

    if (fetchError || !existing) return { error: "Journal entry not found" }

    const original = existing

    if (original.status !== "posted") {
      return { error: `Cannot reverse entry with status "${original.status}"` }
    }

    // Fetch original lines
    const { data: linesRaw, error: linesError } = await supabase.from("ledger_entries")
      .select("account_number_new, debit_amount, credit_amount")
      .eq("journal_entry_id", entryId)

    if (linesError) return { error: linesError.message }

    const originalLines = linesRaw ?? []

    const now = new Date()
    const reversalDate = now.toISOString().split("T")[0]!
    const reversalYear = now.getFullYear()
    const reversalMonth = now.getMonth() + 1

    // Check fiscal period not locked for reversal date
    const lockError = await checkPeriodNotLocked(supabase, orgId, reversalDate)
    if (lockError) return { error: lockError }

    // Generate entry number for reversal
    const entryNumber = await generateEntryNumber(supabase, orgId, reversalYear)

    // Create reversal journal entry
    const { data: reversal, error: insertError } = await supabase.from("journal_entries")
      .insert({
        organization_id: orgId,
        entry_number: entryNumber,
        entry_date: reversalDate,
        period_year: reversalYear,
        period_month: reversalMonth,
        description: `Reversal: ${original.description}`,
        reference_number: original.reference_number,
        invoice_id: original.invoice_id,
        document_id: original.document_id,
        status: "posted",
        is_closing_entry: original.is_closing_entry,
        created_by: user.id,
        posted_by: user.id,
        posted_at: now.toISOString(),
      })
      .select("id")
      .single()

    if (insertError) return { error: insertError.message }

    const reversalId = reversal?.id

    // Insert reversal lines with swapped debit/credit
    const reversalLines = originalLines.map((line) => ({
      journal_entry_id: reversalId,
      organization_id: orgId,
      entry_date: reversalDate,
      period_year: reversalYear,
      period_month: reversalMonth,
      description: `Reversal: ${original.description}`,
      debit_account_number: (Number(line.credit_amount) || 0) > 0 ? (line.account_number_new ?? "") : "",
      credit_account_number: (Number(line.debit_amount) || 0) > 0 ? (line.account_number_new ?? "") : "",
      account_number_new: line.account_number_new ?? "",
      amount: (Number(line.credit_amount) || 0) > 0 ? Number(line.credit_amount) : Number(line.debit_amount) || 0,
      debit_amount: Number(line.credit_amount) || 0,
      credit_amount: Number(line.debit_amount) || 0,
    }))

    const { error: reversalLinesError } = await supabase.from("ledger_entries")
      .insert(reversalLines)

    if (reversalLinesError) return { error: reversalLinesError.message }

    // Mark original as reversed
    const { error: updateError } = await supabase.from("journal_entries")
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
      action: "JOURNAL_ENTRY_REVERSED",
      entityType: "journal_entry",
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

// ─── deleteJournalEntryAction ────────────────────────────────────────────────

export async function deleteJournalEntryAction(
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
    const { data: existing, error: fetchError } = await supabase.from("journal_entries")
      .select("id, status, description")
      .eq("id", entryId)
      .eq("organization_id", orgId)
      .single()

    if (fetchError || !existing) return { error: "Journal entry not found" }

    const entry = existing
    if (entry.status !== "draft") {
      return { error: "Only draft entries can be deleted" }
    }

    // Delete journal entry (cascade deletes lines)
    const { error } = await supabase.from("journal_entries")
      .delete()
      .eq("id", entryId)
      .eq("organization_id", orgId)

    if (error) return { error: error.message }

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "JOURNAL_ENTRY_DELETED",
      entityType: "journal_entry",
      entityId: entryId,
      oldData: { description: entry.description },
    })

    revalidatePath("/ledger")
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── batchPostJournalEntriesAction ───────────────────────────────────────────

export async function batchPostJournalEntriesAction(
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
    const { data: draftsRaw, error: fetchError } = await supabase.from("journal_entries")
      .select("id, status, entry_date")
      .eq("organization_id", orgId)
      .in("id", entryIds)
      .eq("status", "draft")

    if (fetchError) return { error: fetchError.message }
    if (!draftsRaw || draftsRaw.length === 0)
      return { error: "No eligible draft entries to post" }

    const drafts = draftsRaw

    // Check no locked periods
    for (const draft of drafts) {
      const lockError = await checkPeriodNotLocked(supabase, orgId, draft.entry_date)
      if (lockError) return { error: lockError }
    }

    const eligibleIds = drafts.map((d) => d.id)

    const { error } = await supabase.from("journal_entries")
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
        action: "JOURNAL_ENTRY_POSTED",
        entityType: "journal_entry",
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

// ─── Backward-compatible aliases ─────────────────────────────────────────────

/** @deprecated Use createJournalEntryAction instead. */
export const createLedgerEntryAction = createJournalEntryAction as unknown as (data: {
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
}) => Promise<{ error?: string; id?: string }>

/** @deprecated Use postJournalEntryAction instead. */
export const postLedgerEntryAction = postJournalEntryAction

/** @deprecated Use reverseJournalEntryAction instead. */
export const reverseLedgerEntryAction = reverseJournalEntryAction

/** @deprecated Use deleteJournalEntryAction instead. */
export const deleteLedgerEntryAction = deleteJournalEntryAction

/** @deprecated Use batchPostJournalEntriesAction instead. */
export const batchPostEntriesAction = batchPostJournalEntriesAction
