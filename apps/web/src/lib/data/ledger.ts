import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "./org"
import { paginationRange, type PaginationParams, type PaginatedResult } from "./pagination"

// ─── Types ────────────────────────────────────────────────────────────────────

export type JournalEntryLine = {
  id: string
  account_number: string
  account_name?: string
  debit_amount: number
  credit_amount: number
}

export type JournalEntry = {
  id: string
  entry_number: string
  entry_date: string
  description: string
  reference_number: string | null
  invoice_id: string | null
  document_id: string | null
  status: "draft" | "posted" | "reversed"
  is_closing_entry: boolean
  created_by: string | null
  posted_by: string | null
  posted_at: string | null
  created_at: string
  total_amount: number
  lines: JournalEntryLine[]
}

/** @deprecated Use JournalEntry instead. Kept for backward compatibility. */
export type LedgerEntry = {
  id: string
  entry_date: string
  description: string
  reference_number: string | null
  debit_account_number: string
  credit_account_number: string
  amount: number
  currency: string
  status: "draft" | "posted" | "reversed"
  is_closing_entry: boolean
  invoice_id: string | null
  document_id: string | null
  created_by: string | null
  posted_by: string | null
  posted_at: string | null
  created_at: string
}

export type JournalEntryFilters = {
  status?: "draft" | "posted" | "reversed"
  date_from?: string
  date_to?: string
  search?: string
}

/** @deprecated Use JournalEntryFilters instead. */
export type LedgerFilters = JournalEntryFilters & {
  account_number?: string
}

export type ChartAccount = {
  id: string
  account_number: string
  account_name: string
  account_class: string
  account_type: string
  parent_id: string | null
  is_active: boolean
  is_system: boolean
  notes: string | null
  organization_id: string | null
}

export type AccountBalance = {
  account_number: string
  account_name: string
  account_type: string
  debit_total: number
  credit_total: number
  balance: number
}

export type LedgerSummary = {
  totalEntries: number
  draftCount: number
  postedCount: number
  totalDebit: number
  totalCredit: number
}

// ─── getJournalEntries ──────────────────────────────────────────────────────

export async function getJournalEntries(
  filters?: JournalEntryFilters,
  pagination?: PaginationParams
): Promise<PaginatedResult<JournalEntry>> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 }

  const { from, to, page, pageSize } = paginationRange(pagination)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("journal_entries" as any) as any)
    .select(
      "id, entry_number, entry_date, description, reference_number, invoice_id, document_id, status, is_closing_entry, created_by, posted_by, posted_at, created_at",
      { count: "exact" }
    )
    .eq("org_id", orgId)
    .order("entry_date", { ascending: false })
    .range(from, to)

  if (filters?.status) {
    query = query.eq("status", filters.status)
  }
  if (filters?.date_from) {
    query = query.gte("entry_date", filters.date_from)
  }
  if (filters?.date_to) {
    query = query.lte("entry_date", filters.date_to)
  }
  if (filters?.search) {
    query = query.or(
      `description.ilike.%${filters.search}%,reference_number.ilike.%${filters.search}%,entry_number.ilike.%${filters.search}%`
    )
  }

  const { data, error, count } = await query
  if (error) throw error

  const journalEntries = (data ?? []) as unknown as Array<Omit<JournalEntry, "total_amount" | "lines">>

  if (journalEntries.length === 0) {
    return {
      data: [],
      total: count ?? 0,
      page,
      pageSize,
      totalPages: Math.ceil((count ?? 0) / pageSize),
    }
  }

  // Batch-fetch all ledger entry lines for these journal entries
  const entryIds = journalEntries.map((e) => e.id)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: linesRaw, error: linesError } = await (supabase.from("ledger_entries" as any) as any)
    .select("id, journal_entry_id, account_number_new, debit_amount, credit_amount")
    .in("journal_entry_id", entryIds)

  if (linesError) throw linesError

  const lines = (linesRaw ?? []) as unknown as Array<{
    id: string
    journal_entry_id: string
    account_number_new: string
    debit_amount: number
    credit_amount: number
  }>

  // Group lines by journal_entry_id
  const linesByEntry = new Map<string, JournalEntryLine[]>()
  for (const line of lines) {
    const entryLines = linesByEntry.get(line.journal_entry_id) ?? []
    entryLines.push({
      id: line.id,
      account_number: line.account_number_new,
      debit_amount: Number(line.debit_amount) || 0,
      credit_amount: Number(line.credit_amount) || 0,
    })
    linesByEntry.set(line.journal_entry_id, entryLines)
  }

  const result: JournalEntry[] = journalEntries.map((je) => {
    const entryLines = linesByEntry.get(je.id) ?? []
    const totalAmount = entryLines.reduce((sum, l) => sum + l.debit_amount, 0)
    return {
      ...je,
      total_amount: Math.round(totalAmount * 100) / 100,
      lines: entryLines,
    }
  })

  const total = count ?? 0
  return {
    data: result,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

/** @deprecated Use getJournalEntries instead. */
export const getLedgerEntries = getJournalEntries as unknown as (
  filters?: LedgerFilters,
  pagination?: PaginationParams
) => Promise<PaginatedResult<JournalEntry>>

// ─── getChartOfAccounts ───────────────────────────────────────────────────────

export async function getChartOfAccounts(): Promise<ChartAccount[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []

  // Fetch system accounts (organization_id IS NULL) and org-specific accounts
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("chart_of_accounts" as any) as any)
    .select(
      "id, account_number, account_name, account_class, account_type, parent_id, is_active, is_system, notes, organization_id"
    )
    .or(`organization_id.is.null,organization_id.eq.${orgId}`)
    .eq("is_active", true)
    .order("account_number", { ascending: true })

  if (error) throw error
  return (data ?? []) as unknown as ChartAccount[]
}

// ─── getAccountBalances ───────────────────────────────────────────────────────

export async function getAccountBalances(
  year?: number,
  month?: number
): Promise<AccountBalance[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.rpc as any)("get_account_balances", {
    p_org_id: orgId,
    p_year: year ?? null,
    p_month: month ?? null,
  })

  if (error) throw error

  return ((data ?? []) as unknown as AccountBalance[]).map((row) => ({
    account_number: row.account_number,
    account_name: row.account_name,
    account_type: row.account_type,
    debit_total: Number(row.debit_total) || 0,
    credit_total: Number(row.credit_total) || 0,
    balance: Number(row.balance) || 0,
  }))
}

// ─── getLedgerSummary ─────────────────────────────────────────────────────────

export async function getLedgerSummary(): Promise<LedgerSummary> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId)
    return {
      totalEntries: 0,
      draftCount: 0,
      postedCount: 0,
      totalDebit: 0,
      totalCredit: 0,
    }

  // Count journal entries by status
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: entriesRaw, error } = await (supabase.from("journal_entries" as any) as any)
    .select("id, status")
    .eq("org_id", orgId)

  if (error) throw error

  const entries = (entriesRaw ?? []) as unknown as Array<{ id: string; status: string }>

  let draftCount = 0
  let postedCount = 0
  const postedIds: string[] = []

  for (const entry of entries) {
    if (entry.status === "draft") draftCount++
    if (entry.status === "posted") {
      postedCount++
      postedIds.push(entry.id)
    }
  }

  let totalDebit = 0
  let totalCredit = 0

  if (postedIds.length > 0) {
    // Fetch ledger_entries lines for posted journal entries to sum amounts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: linesRaw, error: linesError } = await (supabase.from("ledger_entries" as any) as any)
      .select("debit_amount, credit_amount")
      .in("journal_entry_id", postedIds)

    if (linesError) throw linesError

    const lines = (linesRaw ?? []) as unknown as Array<{
      debit_amount: number
      credit_amount: number
    }>

    for (const line of lines) {
      totalDebit += Number(line.debit_amount) || 0
      totalCredit += Number(line.credit_amount) || 0
    }
  }

  return {
    totalEntries: entries.length,
    draftCount,
    postedCount,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
  }
}
