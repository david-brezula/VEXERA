/**
 * POST /api/bank/reconcile — run auto-reconciliation on unmatched transactions
 * GET  /api/bank/reconcile — list reconciliation suggestions for an org
 *
 * POST body (JSON):
 *   {
 *     organization_id:  string    // UUID
 *     bank_account_id?: string    // optional — filter to one account
 *     transaction_ids?: string[]  // optional — reconcile specific tx IDs only
 *                                 // if omitted: all unmatched for the org
 *     auto_accept_high: boolean   // default true — auto-commit high-confidence matches
 *   }
 *
 * POST returns 200:
 *   {
 *     reconciled: number,           // high-confidence matches auto-committed
 *     suggestions: ReconcileMatch[] // medium/low confidence — user must confirm
 *     errors: string[]
 *   }
 *
 * GET query params:
 *   organization_id — required
 *   limit           — default 50
 *
 * GET returns a list of unmatched transactions with their suggested invoice matches.
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { reconcile, acceptMatch } from "@/lib/services/reconciliation.service"
import { writeAuditLog } from "@/lib/services/audit.server"

const ReconcileSchema = z.object({
  organization_id: z.string().uuid(),
  bank_account_id: z.string().uuid().optional(),
  transaction_ids: z.array(z.string().uuid()).optional(),
  auto_accept_high: z.boolean().default(true),
})

// ─── GET — list unmatched transactions with suggestions ───────────────────────

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const organizationId = url.searchParams.get("organization_id")
    if (!organizationId) {
      return NextResponse.json({ error: "organization_id is required" }, { status: 400 })
    }

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    const limit = parseInt(url.searchParams.get("limit") ?? "50")

    // Fetch unmatched transactions
    const { data: txRows, error: txErr } = await supabase
      .from("bank_transactions")
      .select("id, transaction_date, amount, currency, variable_symbol, description, counterpart_name, match_status")
      .eq("organization_id", organizationId)
      .eq("match_status", "unmatched")
      .order("transaction_date", { ascending: false })
      .limit(limit)

    if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })

    const transactions = (txRows ?? []) as Array<{ id: string }>
    if (transactions.length === 0) {
      return NextResponse.json({ data: [], suggestions: [], message: "All transactions are reconciled" })
    }

    // Run reconciliation to get suggestions (read-only — does not commit)
    const txIds = transactions.map((t) => t.id)
    const result = await reconcile(supabase, organizationId, txIds)

    return NextResponse.json({
      data: txRows ?? [],
      suggestions: result.matched,
      unmatched_count: result.unmatched_transaction_ids.length,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}

// ─── POST — run reconciliation and optionally commit high-confidence matches ──

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const parsed = ReconcileSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { organization_id, bank_account_id, transaction_ids, auto_accept_high } = parsed.data

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Resolve which transaction IDs to reconcile
    let txIds: string[]

    if (transaction_ids && transaction_ids.length > 0) {
      txIds = transaction_ids
    } else {
      // Fetch all unmatched for the org (optionally filtered by account)
      let query = supabase
        .from("bank_transactions")
        .select("id")
        .eq("organization_id", organization_id)
        .eq("match_status", "unmatched")
        .limit(500)

      if (bank_account_id) {
        query = query.eq("bank_account_id", bank_account_id)
      }

      const { data: txRows, error: txErr } = await query
      if (txErr) return NextResponse.json({ error: txErr.message }, { status: 500 })
      txIds = (txRows ?? []).map((r: { id: string }) => r.id)
    }

    if (txIds.length === 0) {
      return NextResponse.json({ reconciled: 0, suggestions: [], errors: [], message: "No unmatched transactions" })
    }

    const { matched, unmatched_transaction_ids: _ } = await reconcile(supabase, organization_id, txIds)

    const errors: string[] = []
    let reconciledCount = 0
    const suggestions = []

    for (const match of matched) {
      if (auto_accept_high && match.confidence === "high") {
        const { error } = await acceptMatch(supabase, match, user.id, organization_id)
        if (!error) {
          reconciledCount++
          await writeAuditLog(supabase, {
            organizationId: organization_id,
            userId: user.id,
            action: "BANK_TRANSACTION_MATCHED",
            entityType: "bank_transaction",
            entityId: match.transaction_id,
            newData: {
              invoice_id: match.invoice_id,
              invoice_number: match.invoice_number,
              confidence: match.confidence,
              match_reason: match.match_reason,
            },
          })
        } else {
          errors.push(`Failed to commit match for invoice ${match.invoice_number}: ${error}`)
        }
      } else {
        suggestions.push(match)
      }
    }

    return NextResponse.json({ reconciled: reconciledCount, suggestions, errors })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
