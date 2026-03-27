/**
 * Reconciliation Service
 *
 * Automatically matches bank transactions against open invoices.
 *
 * Match strategy (in order of priority):
 *   1. Variable symbol (VS) matches invoice variable_symbol AND
 *      amount matches invoice total (within 0.01 EUR tolerance)
 *   2. Amount-only match when there is exactly ONE open invoice
 *      with the same total AND same currency
 *
 * Returns a list of suggested matches — does NOT auto-commit.
 * Caller decides to accept or reject each match.
 *
 * Usage (in a server action):
 *   const matches = await reconcile(supabase, orgId, transactions)
 *   for (const m of matches) {
 *     if (m.confidence === "high") await acceptMatch(supabase, m)
 *   }
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export type MatchConfidence = "high" | "medium" | "low"

export interface ReconcileMatch {
  transaction_id: string
  invoice_id: string
  invoice_number: string
  invoice_total: number
  transaction_amount: number
  confidence: MatchConfidence
  match_reason: string
}

export interface ReconcileResult {
  matched: ReconcileMatch[]
  unmatched_transaction_ids: string[]
}

type OpenInvoice = {
  id: string
  invoice_number: string
  total: number
  currency: string
  variable_symbol: string | null
}

type TxRow = {
  id: string
  amount: number
  currency: string
  variable_symbol: string | null
}

const AMOUNT_TOLERANCE = 0.01

function amountsMatch(txAmount: number, invoiceTotal: number): boolean {
  return Math.abs(Math.abs(txAmount) - invoiceTotal) <= AMOUNT_TOLERANCE
}

/** Normalize variable symbol by stripping leading zeros for comparison */
function normalizeVS(vs: string | null): string | null {
  if (!vs) return null
  const trimmed = vs.trim().replace(/^0+/, "")
  return trimmed || "0" // preserve "0" if the VS is all zeros
}

/** Normalize currency code to uppercase for case-insensitive comparison */
function normalizeCurrency(c: string): string {
  return c.trim().toUpperCase()
}

export async function reconcile(
  supabase: SupabaseClient,
  organizationId: string,
  transactionIds: string[]
): Promise<ReconcileResult> {
  if (transactionIds.length === 0) {
    return { matched: [], unmatched_transaction_ids: [] }
  }

  // Fetch the transactions
  const { data: txRows, error: txErr } = await supabase
    .from("bank_transactions")
    .select("id, amount, currency, variable_symbol")
    .eq("organization_id", organizationId)
    .eq("match_status", "unmatched")
    .in("id", transactionIds)

  if (txErr || !txRows) return { matched: [], unmatched_transaction_ids: transactionIds }

  // Fetch all open (unpaid) issued invoices for the org
  const { data: invoices, error: invErr } = await supabase
    .from("invoices")
    .select("id, invoice_number, total, currency, variable_symbol")
    .eq("organization_id", organizationId)
    .in("status", ["sent", "overdue"])
    .is("deleted_at", null)

  if (invErr || !invoices) return { matched: [], unmatched_transaction_ids: transactionIds }

  const openInvoices = invoices as OpenInvoice[]
  const transactions = txRows as TxRow[]

  const matched: ReconcileMatch[] = []
  const matchedInvoiceIds = new Set<string>()
  const unmatchedTxIds: string[] = []

  for (const tx of transactions) {
    // Only match credits (positive amounts = incoming payment)
    if (tx.amount <= 0) {
      unmatchedTxIds.push(tx.id)
      continue
    }

    let bestMatch: ReconcileMatch | null = null

    // Strategy 1: VS + amount
    const txVS = normalizeVS(tx.variable_symbol)
    const txCur = normalizeCurrency(tx.currency)
    if (txVS) {
      const vsMatch = openInvoices.find(
        (inv) =>
          !matchedInvoiceIds.has(inv.id) &&
          normalizeVS(inv.variable_symbol) === txVS &&
          normalizeCurrency(inv.currency) === txCur &&
          amountsMatch(tx.amount, inv.total)
      )
      if (vsMatch) {
        bestMatch = {
          transaction_id: tx.id,
          invoice_id: vsMatch.id,
          invoice_number: vsMatch.invoice_number,
          invoice_total: vsMatch.total,
          transaction_amount: tx.amount,
          confidence: "high",
          match_reason: `Variable symbol (${tx.variable_symbol}) + amount match`,
        }
      }
    }

    // Strategy 2: VS only (no amount check) — medium confidence
    if (!bestMatch && txVS) {
      const vsOnly = openInvoices.find(
        (inv) =>
          !matchedInvoiceIds.has(inv.id) &&
          normalizeVS(inv.variable_symbol) === txVS &&
          normalizeCurrency(inv.currency) === txCur
      )
      if (vsOnly) {
        bestMatch = {
          transaction_id: tx.id,
          invoice_id: vsOnly.id,
          invoice_number: vsOnly.invoice_number,
          invoice_total: vsOnly.total,
          transaction_amount: tx.amount,
          confidence: "medium",
          match_reason: `Variable symbol match (${tx.variable_symbol}), amount differs`,
        }
      }
    }

    // Strategy 3: amount only — only if exactly one open invoice with that amount
    if (!bestMatch) {
      const amountCandidates = openInvoices.filter(
        (inv) =>
          !matchedInvoiceIds.has(inv.id) &&
          normalizeCurrency(inv.currency) === txCur &&
          amountsMatch(tx.amount, inv.total)
      )
      if (amountCandidates.length === 1) {
        bestMatch = {
          transaction_id: tx.id,
          invoice_id: amountCandidates[0]!.id,
          invoice_number: amountCandidates[0]!.invoice_number,
          invoice_total: amountCandidates[0]!.total,
          transaction_amount: tx.amount,
          confidence: "low",
          match_reason: `Amount-only match (${tx.amount} ${tx.currency}) — only one open invoice with this amount`,
        }
      }
    }

    if (bestMatch) {
      matched.push(bestMatch)
      matchedInvoiceIds.add(bestMatch.invoice_id)
    } else {
      unmatchedTxIds.push(tx.id)
    }
  }

  return { matched, unmatched_transaction_ids: unmatchedTxIds }
}

/**
 * Commits a reconciliation match to the database.
 * Updates both the bank_transaction and the invoice status.
 */
export async function acceptMatch(
  supabase: SupabaseClient,
  match: ReconcileMatch,
  userId: string,
  organizationId: string
): Promise<{ error?: string }> {
  const now = new Date().toISOString()

  const { error: txErr } = await supabase
    .from("bank_transactions")
    .update({
      match_status: "matched",
      matched_invoice_id: match.invoice_id,
      matched_at: now,
      matched_by: userId,
    })
    .eq("id", match.transaction_id)
    .eq("organization_id", organizationId)

  if (txErr) return { error: txErr.message }

  // Mark invoice as paid
  const { error: invErr } = await supabase
    .from("invoices")
    .update({ status: "paid", paid_at: now })
    .eq("id", match.invoice_id)
    .eq("organization_id", organizationId)

  if (invErr) return { error: invErr.message }

  return {}
}
