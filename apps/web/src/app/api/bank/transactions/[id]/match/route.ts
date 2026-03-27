/**
 * PATCH /api/bank/transactions/[id]/match
 *
 * Manually match a bank transaction to an invoice, or ignore it.
 *
 * Body (JSON, one of two options):
 *   Option A — manual match:  { organization_id: uuid, invoice_id: uuid }
 *   Option B — ignore:        { organization_id: uuid, match_status: "ignored" }
 *
 * Response 200: { success: true, data: { match_status, matched_invoice_id } }
 * Response 400/401/403/404/500: { error: string }
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/shared/services/audit.server"

// ─── Zod schemas ───────────────────────────────────────────────────────────────

const manualMatchSchema = z.object({
  organization_id: z.string().uuid("organization_id must be a valid UUID"),
  invoice_id: z.string().uuid("invoice_id must be a valid UUID"),
})

const ignoreSchema = z.object({
  organization_id: z.string().uuid("organization_id must be a valid UUID"),
  match_status: z.literal("ignored"),
})

const bodySchema = z.union([manualMatchSchema, ignoreSchema])

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { id: transactionId } = await params

    if (!transactionId) {
      return NextResponse.json({ error: "Missing transaction id" }, { status: 400 })
    }

    // Parse and validate body
    let rawBody: unknown
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
    }

    const parsed = bodySchema.safeParse(rawBody)
    if (!parsed.success) {
      const message = parsed.error.issues.map((e: { message: string }) => e.message).join("; ")
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const body = parsed.data
    const organizationId = body.organization_id

    // Verify org membership
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

    // Verify the transaction belongs to the org
    const { data: transaction, error: txFetchErr } = await supabase.from("bank_transactions")
      .select("id, match_status, amount")
      .eq("id", transactionId)
      .eq("organization_id", organizationId)
      .single()

    if (txFetchErr || !transaction) {
      return NextResponse.json(
        { error: "Transaction not found or does not belong to this organization" },
        { status: 404 }
      )
    }

    const now = new Date().toISOString()

    // ── Option B: ignore ────────────────────────────────────────────────────────
    if ("match_status" in body && body.match_status === "ignored") {
      const { data: updated, error: updateErr } = await supabase.from("bank_transactions")
        .update({ match_status: "ignored" })
        .eq("id", transactionId)
        .eq("organization_id", organizationId)
        .select("match_status, matched_invoice_id")
        .single()

      if (updateErr) {
        console.error("bank/transactions/[id]/match PATCH (ignore) error:", updateErr)
        return NextResponse.json({ error: updateErr.message }, { status: 500 })
      }

      await writeAuditLog(supabase, {
        organizationId,
        userId: user.id,
        action: "BANK_TRANSACTION_UNMATCHED",
        entityType: "bank_transaction",
        entityId: transactionId,
        newData: { match_status: "ignored" },
      })

      const row = updated as { match_status: string; matched_invoice_id: string | null }
      return NextResponse.json({
        success: true,
        data: {
          match_status: row.match_status,
          matched_invoice_id: row.matched_invoice_id,
        },
      })
    }

    // ── Option A: manually match to invoice ────────────────────────────────────
    if ("invoice_id" in body) {
      const invoiceId = body.invoice_id

      // Verify the invoice belongs to the org
      const { data: invoice, error: invFetchErr } = await supabase
        .from("invoices")
        .select("id, status, total, paid_amount, remaining_amount")
        .eq("id", invoiceId)
        .eq("organization_id", organizationId)
        .single()

      if (invFetchErr || !invoice) {
        return NextResponse.json(
          { error: "Invoice not found or does not belong to this organization" },
          { status: 404 }
        )
      }

      // Update bank_transaction
      const { data: updatedTx, error: txUpdateErr } = await supabase.from("bank_transactions")
        .update({
          match_status: "manually_matched",
          matched_invoice_id: invoiceId,
          matched_at: now,
          matched_by: user.id,
        })
        .eq("id", transactionId)
        .eq("organization_id", organizationId)
        .select("match_status, matched_invoice_id")
        .single()

      if (txUpdateErr) {
        console.error("bank/transactions/[id]/match PATCH (match) tx update error:", txUpdateErr)
        return NextResponse.json({ error: txUpdateErr.message }, { status: 500 })
      }

      // Update invoice status based on how much has been paid
      const newPaidAmount = (invoice.paid_amount || 0) + Math.abs(transaction.amount)
      const isFullyPaid = newPaidAmount >= invoice.total

      const invoiceUpdate = isFullyPaid
        ? { status: "paid" as const, paid_amount: newPaidAmount, paid_at: now }
        : { status: "partially_paid" as const, paid_amount: newPaidAmount }

      const { error: invUpdateErr } = await supabase
        .from("invoices")
        .update(invoiceUpdate)
        .eq("id", invoiceId)
        .eq("organization_id", organizationId)

      if (invUpdateErr) {
        console.error("bank/transactions/[id]/match PATCH (match) invoice update error:", invUpdateErr)
        return NextResponse.json({ error: invUpdateErr.message }, { status: 500 })
      }

      await writeAuditLog(supabase, {
        organizationId,
        userId: user.id,
        action: "BANK_TRANSACTION_MATCHED",
        entityType: "bank_transaction",
        entityId: transactionId,
        newData: {
          match_status: "manually_matched",
          matched_invoice_id: invoiceId,
          matched_at: now,
          matched_by: user.id,
        },
      })

      const row = updatedTx as { match_status: string; matched_invoice_id: string | null }
      return NextResponse.json({
        success: true,
        data: {
          match_status: row.match_status,
          matched_invoice_id: row.matched_invoice_id,
        },
      })
    }

    // Should not reach here due to Zod union validation
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Match operation failed"
    console.error("bank/transactions/[id]/match PATCH error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
