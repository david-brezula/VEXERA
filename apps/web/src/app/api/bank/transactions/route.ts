/**
 * GET /api/bank/transactions
 *
 * Lists bank transactions for an organization with optional filters.
 *
 * Query params:
 *   organization_id  — required
 *   match_status     — optional: 'unmatched' | 'matched' | 'manually_matched' | 'ignored'
 *   bank_account_id  — optional: filter to one account
 *   date_from        — optional: ISO date, filter transaction_date >=
 *   date_to          — optional: ISO date, filter transaction_date <=
 *   limit            — default 100
 *   offset           — default 0
 *
 * Response 200: { data: BankTransaction[], count: number }
 * Response 400/401/403/500: { error: string }
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import type { BankTransaction, BankTransactionMatchStatus } from "@vexera/types"

const querySchema = z.object({
  organization_id: z.string().uuid("organization_id must be a valid UUID"),
  match_status: z
    .enum(["unmatched", "matched", "manually_matched", "ignored"])
    .optional(),
  bank_account_id: z.string().uuid("bank_account_id must be a valid UUID").optional(),
  date_from: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date_from must be ISO date YYYY-MM-DD")
    .optional(),
  date_to: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "date_to must be ISO date YYYY-MM-DD")
    .optional(),
  limit: z.coerce.number().int().min(1).max(500).default(100),
  offset: z.coerce.number().int().min(0).default(0),
})

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const raw = Object.fromEntries(searchParams.entries())
    const parsed = querySchema.safeParse(raw)

    if (!parsed.success) {
      const message = parsed.error.issues.map((e: { message: string }) => e.message).join("; ")
      return NextResponse.json({ error: message }, { status: 400 })
    }

    const {
      organization_id,
      match_status,
      bank_account_id,
      date_from,
      date_to,
      limit,
      offset,
    } = parsed.data

    // Verify org membership
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json(
        { error: "Not a member of this organization" },
        { status: 403 }
      )
    }

    let query = supabase.from("bank_transactions")
      .select("*", { count: "exact" })
      .eq("organization_id", organization_id)
      .order("transaction_date", { ascending: false })
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (match_status) {
      query = query.eq("match_status", match_status)
    }

    if (bank_account_id) {
      query = query.eq("bank_account_id", bank_account_id)
    }

    if (date_from) {
      query = query.gte("transaction_date", date_from)
    }

    if (date_to) {
      query = query.lte("transaction_date", date_to)
    }

    const { data, error, count } = await query

    if (error) {
      console.error("bank/transactions GET error:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      data: (data ?? []) as BankTransaction[],
      count: count ?? 0,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch transactions"
    console.error("bank/transactions GET error:", err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
