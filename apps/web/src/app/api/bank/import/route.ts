/**
 * POST /api/bank/import
 *
 * Accepts a bank statement file (CSV or MT940), parses it,
 * inserts new transactions into bank_transactions, runs
 * automatic reconciliation, and returns a summary.
 *
 * Request: multipart/form-data
 *   file            — the statement file
 *   bank_account_id — UUID of the target bank account
 *   organization_id — UUID of the organization
 *
 * Response 200:
 *   {
 *     imported: number,       // rows successfully inserted
 *     duplicates: number,     // rows skipped (already imported)
 *     errors: string[],       // non-fatal parse warnings
 *     reconciled: number,     // invoices automatically marked paid
 *     matches: ReconcileMatch[]  // suggested matches (confidence: medium | low)
 *   }
 *
 * Response 400/401/403/500: { error: string }
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { parseBankStatement } from "@/lib/services/bank-import.service"
import { reconcile, acceptMatch } from "@/lib/services/reconciliation.service"
import type { ReconcileMatch } from "@/lib/services/reconciliation.service"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const bankAccountId = formData.get("bank_account_id") as string | null
    const organizationId = formData.get("organization_id") as string | null

    if (!file || !bankAccountId || !organizationId) {
      return NextResponse.json(
        { error: "Missing required fields: file, bank_account_id, organization_id" },
        { status: 400 }
      )
    }

    // Verify the user is a member of the organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this organization" },
        { status: 403 }
      )
    }

    // Verify the bank account belongs to the organization
    const { data: account } = await supabase
      .from("bank_accounts")
      .select("id, currency")
      .eq("id", bankAccountId)
      .eq("organization_id", organizationId)
      .single()

    if (!account) {
      return NextResponse.json(
        { error: "Bank account not found or does not belong to this organization" },
        { status: 404 }
      )
    }

    // Parse the file
    const text = await file.text()
    const { transactions, errors } = parseBankStatement(text)

    if (transactions.length === 0) {
      return NextResponse.json({
        imported: 0,
        duplicates: 0,
        errors: errors.length > 0 ? errors : ["No transactions found in file"],
        reconciled: 0,
        matches: [],
      })
    }

    // Insert transactions — use ON CONFLICT DO NOTHING for deduplication
    // external_id uniqueness is enforced by the DB constraint
    // We insert in batches to avoid hitting Supabase row limits
    const BATCH_SIZE = 200
    let imported = 0
    let duplicates = 0
    const insertedIds: string[] = []

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      const batch = transactions.slice(i, i + BATCH_SIZE).map((tx) => ({
        organization_id: organizationId,
        bank_account_id: bankAccountId,
        transaction_date: tx.transaction_date,
        amount: tx.amount,
        currency: tx.currency ?? (account as unknown as { currency: string }).currency,
        variable_symbol: tx.variable_symbol,
        constant_symbol: tx.constant_symbol,
        specific_symbol: tx.specific_symbol,
        description: tx.description,
        counterpart_iban: tx.counterpart_iban,
        counterpart_name: tx.counterpart_name,
        external_id: tx.external_id,
        source_file_name: file.name,
      }))

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bankTxTable = supabase.from("bank_transactions" as any)
      const { data: inserted, error: insertErr } = await bankTxTable
        .upsert(batch as unknown as never, {
          onConflict: "bank_account_id,external_id",
          ignoreDuplicates: true,
        })
        .select("id")

      if (insertErr) {
        // If upsert not available, fall back to insert with error handling
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: fallbackInserted, error: fallbackErr } = await supabase
          .from("bank_transactions" as any)
          .insert(batch as unknown as never)
          .select("id")

        if (fallbackErr) {
          errors.push(`Batch ${Math.floor(i / BATCH_SIZE) + 1}: ${fallbackErr.message}`)
          continue
        }
        const count = fallbackInserted?.length ?? 0
        imported += count
        duplicates += batch.length - count
        const fbRows = fallbackInserted as unknown as Array<{ id: string }> | null
        insertedIds.push(...(fbRows?.map((r) => r.id) ?? []))
      } else {
        const count = inserted?.length ?? 0
        imported += count
        duplicates += batch.length - count
        const insRows = inserted as unknown as Array<{ id: string }> | null
        insertedIds.push(...(insRows?.map((r) => r.id) ?? []))
      }
    }

    // Run reconciliation on newly inserted transactions
    const { matched, unmatched_transaction_ids: _ } = await reconcile(
      supabase,
      organizationId,
      insertedIds
    )

    // Auto-accept high-confidence matches
    let reconciledCount = 0
    const pendingMatches: ReconcileMatch[] = []

    for (const m of matched) {
      if (m.confidence === "high") {
        const { error: acceptErr } = await acceptMatch(supabase, m, user.id, organizationId)
        if (!acceptErr) {
          reconciledCount++
        } else {
          errors.push(`Auto-reconcile failed for invoice ${m.invoice_number}: ${acceptErr}`)
        }
      } else {
        pendingMatches.push(m)
      }
    }

    // Audit log
    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      user_id: user.id,
      action: "BANK_STATEMENT_IMPORTED",
      entity_type: "bank_account",
      entity_id: bankAccountId,
      new_data: {
        file_name: file.name,
        imported,
        duplicates,
        reconciled: reconciledCount,
      },
    })

    return NextResponse.json({
      imported,
      duplicates,
      errors,
      reconciled: reconciledCount,
      matches: pendingMatches,  // medium/low confidence — UI should ask user to confirm
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed"
    console.error("bank/import error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
