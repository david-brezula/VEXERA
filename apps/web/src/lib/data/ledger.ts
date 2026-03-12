import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "./org"
import { paginationRange, type PaginationParams, type PaginatedResult } from "./pagination"

// ─── Types ────────────────────────────────────────────────────────────────────

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

export type LedgerFilters = {
  status?: "draft" | "posted" | "reversed"
  date_from?: string
  date_to?: string
  account_number?: string
  search?: string
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

// ─── getLedgerEntries ─────────────────────────────────────────────────────────

export async function getLedgerEntries(
  filters?: LedgerFilters,
  pagination?: PaginationParams
): Promise<PaginatedResult<LedgerEntry>> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 }

  const { from, to, page, pageSize } = paginationRange(pagination)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("ledger_entries" as any) as any)
    .select(
      "id, entry_date, description, reference_number, debit_account_number, credit_account_number, amount, currency, status, is_closing_entry, invoice_id, document_id, created_by, posted_by, posted_at, created_at",
      { count: "exact" }
    )
    .eq("organization_id", orgId)
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
  if (filters?.account_number) {
    query = query.or(
      `debit_account_number.eq.${filters.account_number},credit_account_number.eq.${filters.account_number}`
    )
  }
  if (filters?.search) {
    query = query.or(
      `description.ilike.%${filters.search}%,reference_number.ilike.%${filters.search}%`
    )
  }

  const { data, error, count } = await query
  if (error) throw error

  const total = count ?? 0
  return {
    data: (data ?? []) as unknown as LedgerEntry[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

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

  // Fetch all posted entries, optionally filtered by period
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query = (supabase.from("ledger_entries" as any) as any)
    .select(
      "debit_account_number, credit_account_number, amount"
    )
    .eq("organization_id", orgId)
    .eq("status", "posted")

  if (year) {
    query = query.eq("period_year", year)
  }
  if (month) {
    query = query.eq("period_month", month)
  }

  const { data: entries, error: entriesError } = await query
  if (entriesError) throw entriesError

  const typedEntries = (entries ?? []) as unknown as Array<{
    debit_account_number: string
    credit_account_number: string
    amount: number
  }>

  // Fetch chart of accounts for names and types
  const accounts = await getChartOfAccounts()
  const accountMap = new Map(
    accounts.map((a) => [a.account_number, { name: a.account_name, type: a.account_type }])
  )

  // Aggregate debits and credits by account
  const balances = new Map<
    string,
    { debit_total: number; credit_total: number }
  >()

  for (const entry of typedEntries) {
    // Debit side
    const debit = balances.get(entry.debit_account_number) ?? {
      debit_total: 0,
      credit_total: 0,
    }
    debit.debit_total += Number(entry.amount)
    balances.set(entry.debit_account_number, debit)

    // Credit side
    const credit = balances.get(entry.credit_account_number) ?? {
      debit_total: 0,
      credit_total: 0,
    }
    credit.credit_total += Number(entry.amount)
    balances.set(entry.credit_account_number, credit)
  }

  const result: AccountBalance[] = []
  for (const [accountNumber, totals] of balances) {
    const info = accountMap.get(accountNumber)
    result.push({
      account_number: accountNumber,
      account_name: info?.name ?? accountNumber,
      account_type: info?.type ?? "unknown",
      debit_total: Math.round(totals.debit_total * 100) / 100,
      credit_total: Math.round(totals.credit_total * 100) / 100,
      balance:
        Math.round((totals.debit_total - totals.credit_total) * 100) / 100,
    })
  }

  // Sort by account number
  result.sort((a, b) => a.account_number.localeCompare(b.account_number))
  return result
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("ledger_entries" as any) as any)
    .select("status, amount, debit_account_number, credit_account_number")
    .eq("organization_id", orgId)

  if (error) throw error

  const entries = (data ?? []) as unknown as Array<{
    status: string
    amount: number
    debit_account_number: string
    credit_account_number: string
  }>

  let draftCount = 0
  let postedCount = 0
  let totalDebit = 0
  let totalCredit = 0

  for (const entry of entries) {
    if (entry.status === "draft") draftCount++
    if (entry.status === "posted") postedCount++
    // Sum amounts for posted entries only
    if (entry.status === "posted") {
      totalDebit += Number(entry.amount)
      totalCredit += Number(entry.amount)
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
