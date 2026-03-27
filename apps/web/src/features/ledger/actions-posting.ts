"use server"

// ─── Invoice-to-Ledger Posting Helper ────────────────────────────────────────
//
// Creates a draft journal entry + ledger lines when an invoice is created.
// Called from createInvoiceAction — failures are non-fatal (caught by caller).

import type { createClient } from "@/lib/supabase/server"

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

type InvoiceForPosting = {
  id: string
  invoice_number: string
  invoice_type: "issued" | "received" | "credit_note"
  issue_date: string
  subtotal: number
  vat_amount: number
  total: number
}

// ─── helpers ────────────────────────────────────────────────────────────────

async function generateEntryNumber(
  supabase: SupabaseClient,
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

async function getDefaults(supabase: SupabaseClient, orgId: string) {
  const { data } = await supabase.from("organization_ledger_settings")
    .select("*")
    .eq("organization_id", orgId)
    .maybeSingle()

  const settings = data as {
    default_receivable_account?: string
    default_payable_account?: string
    default_revenue_account?: string
    default_expense_account?: string
    default_vat_output_account?: string
    default_vat_input_account?: string
  } | null

  return {
    receivable: settings?.default_receivable_account ?? "311",
    payable: settings?.default_payable_account ?? "321",
    revenue: settings?.default_revenue_account ?? "602",
    expense: settings?.default_expense_account ?? "501",
    vatOutput: settings?.default_vat_output_account ?? "343100",
    vatInput: settings?.default_vat_input_account ?? "343200",
  }
}

// ─── postInvoiceToLedger ────────────────────────────────────────────────────

export async function postInvoiceToLedger(
  supabase: SupabaseClient,
  orgId: string,
  userId: string,
  invoice: InvoiceForPosting
): Promise<{ journalEntryId?: string; error?: string }> {
  const defaults = await getDefaults(supabase, orgId)

  // ── Build ledger lines based on invoice type ──────────────────────────────
  const lines: { account_number: string; debit_amount: number; credit_amount: number }[] = []

  const subtotal = Math.round(invoice.subtotal * 100) / 100
  const vatAmount = Math.round(invoice.vat_amount * 100) / 100
  const total = Math.round(invoice.total * 100) / 100

  switch (invoice.invoice_type) {
    case "issued": {
      // Debit: receivable (311) for total
      lines.push({ account_number: defaults.receivable, debit_amount: total, credit_amount: 0 })
      // Credit: revenue (602) for subtotal (net)
      lines.push({ account_number: defaults.revenue, debit_amount: 0, credit_amount: subtotal })
      // Credit: VAT output (343) for vat_amount (if > 0)
      if (vatAmount > 0) {
        lines.push({ account_number: defaults.vatOutput, debit_amount: 0, credit_amount: vatAmount })
      }
      break
    }
    case "received": {
      // Debit: expense (501) for subtotal (net)
      lines.push({ account_number: defaults.expense, debit_amount: subtotal, credit_amount: 0 })
      // Debit: VAT input (343) for vat_amount (if > 0)
      if (vatAmount > 0) {
        lines.push({ account_number: defaults.vatInput, debit_amount: vatAmount, credit_amount: 0 })
      }
      // Credit: payable (321) for total
      lines.push({ account_number: defaults.payable, debit_amount: 0, credit_amount: total })
      break
    }
    case "credit_note": {
      // Reverse of issued invoice:
      // Credit: receivable — total (use absolute values since credit notes have negative amounts)
      const absTotal = Math.abs(total)
      const absSubtotal = Math.abs(subtotal)
      const absVat = Math.abs(vatAmount)

      lines.push({ account_number: defaults.revenue, debit_amount: absSubtotal, credit_amount: 0 })
      if (absVat > 0) {
        lines.push({ account_number: defaults.vatOutput, debit_amount: absVat, credit_amount: 0 })
      }
      lines.push({ account_number: defaults.receivable, debit_amount: 0, credit_amount: absTotal })
      break
    }
  }

  // Need at least 2 lines for a valid journal entry
  if (lines.length < 2) {
    return { error: "Insufficient ledger lines to create journal entry" }
  }

  // ── Generate entry number ─────────────────────────────────────────────────
  const entryDate = new Date(invoice.issue_date)
  const periodYear = entryDate.getFullYear()
  const periodMonth = entryDate.getMonth() + 1

  const entryNumber = await generateEntryNumber(supabase, orgId, periodYear)

  // ── Insert journal entry ──────────────────────────────────────────────────
  const { data: entry, error: entryError } = await supabase.from("journal_entries")
    .insert({
      organization_id: orgId,
      entry_number: entryNumber,
      entry_date: invoice.issue_date,
      period_year: periodYear,
      period_month: periodMonth,
      description: `Invoice ${invoice.invoice_number}`,
      reference_number: invoice.invoice_number,
      invoice_id: invoice.id,
      status: "draft",
      is_closing_entry: false,
      created_by: userId,
    })
    .select("id")
    .single()

  if (entryError) {
    return { error: entryError.message }
  }

  const journalEntryId = entry?.id

  // ── Insert ledger entry lines ─────────────────────────────────────────────
  const lineInserts = lines.map((line) => ({
    journal_entry_id: journalEntryId,
    organization_id: orgId,
    entry_date: invoice.issue_date,
    period_year: periodYear,
    period_month: periodMonth,
    description: `Invoice ${invoice.invoice_number}`,
    debit_account_number: line.debit_amount > 0 ? line.account_number : "",
    credit_account_number: line.credit_amount > 0 ? line.account_number : "",
    account_number_new: line.account_number,
    amount: line.debit_amount > 0 ? line.debit_amount : line.credit_amount,
    debit_amount: line.debit_amount,
    credit_amount: line.credit_amount,
  }))

  const { error: linesError } = await supabase.from("ledger_entries")
    .insert(lineInserts)

  if (linesError) {
    return { error: linesError.message }
  }

  return { journalEntryId }
}
