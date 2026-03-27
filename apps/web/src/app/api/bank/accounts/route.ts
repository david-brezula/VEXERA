/**
 * GET  /api/bank/accounts  — list bank accounts for an organization
 * POST /api/bank/accounts  — create a new bank account
 *
 * GET query params:
 *   organization_id — required
 *
 * POST body (JSON):
 *   {
 *     organization_id: string   // UUID
 *     bank_name:       string   // e.g. "Tatra banka"
 *     iban:            string   // Slovak IBAN: SK + 22 digits
 *     swift?:          string
 *     currency?:       string   // default "EUR"
 *     account_holder?: string
 *   }
 *
 * PATCH /api/bank/accounts?id=<uuid>  — update account fields
 * DELETE /api/bank/accounts?id=<uuid> — soft-deactivate (is_active = false)
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/shared/services/audit.server"

const CreateSchema = z.object({
  organization_id: z.string().uuid(),
  bank_name: z.string().min(1).max(100),
  iban: z.string().min(15).max(34).toUpperCase(),
  swift: z.string().max(11).optional(),
  currency: z.string().length(3).toUpperCase().default("EUR"),
  account_holder: z.string().max(200).optional(),
})

const UpdateSchema = z.object({
  bank_name: z.string().min(1).max(100).optional(),
  swift: z.string().max(11).optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  account_holder: z.string().max(200).optional(),
  is_active: z.boolean().optional(),
})

// ─── Membership guard ─────────────────────────────────────────────────────────

async function assertMember(
  supabase: ReturnType<typeof createClient> extends Promise<infer T> ? T : never,
  organizationId: string,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .single()
  return !!data
}

// ─── GET ──────────────────────────────────────────────────────────────────────

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

    if (!(await assertMember(supabase, organizationId, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data, error } = await supabase
      .from("bank_accounts")
      .select("id, bank_name, iban, swift, currency, account_holder, is_active, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ data: data ?? [] })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const parsed = CreateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { organization_id, ...fields } = parsed.data

    if (!(await assertMember(supabase, organization_id, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data, error } = await supabase.from("bank_accounts")
      .insert({ organization_id, ...fields })
      .select("id, bank_name, iban, swift, currency, account_holder, is_active, created_at")
      .single()

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "This IBAN is already registered for your organization" }, { status: 409 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    await writeAuditLog(supabase, {
      organizationId: organization_id,
      userId: user.id,
      action: "BANK_ACCOUNT_CREATED",
      entityType: "bank_account",
      entityId: (data as { id: string }).id,
      newData: { bank_name: fields.bank_name, iban: fields.iban, currency: fields.currency },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id query param is required" }, { status: 400 })

    const body = await request.json()
    const parsed = UpdateSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    // Verify ownership via RLS-safe lookup
    const { data: existing } = await supabase
      .from("bank_accounts")
      .select("id, organization_id")
      .eq("id", id)
      .single()

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { organization_id } = existing as { id: string; organization_id: string }
    if (!(await assertMember(supabase, organization_id, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { data, error } = await supabase.from("bank_accounts")
      .update(parsed.data)
      .eq("id", id)
      .eq("organization_id", organization_id)
      .select("id, bank_name, iban, swift, currency, account_holder, is_active, updated_at")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog(supabase, {
      organizationId: organization_id,
      userId: user.id,
      action: "BANK_ACCOUNT_UPDATED",
      entityType: "bank_account",
      entityId: id,
      newData: parsed.data,
    })

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const id = url.searchParams.get("id")
    if (!id) return NextResponse.json({ error: "id query param is required" }, { status: 400 })

    const { data: existing } = await supabase
      .from("bank_accounts")
      .select("id, organization_id, bank_name")
      .eq("id", id)
      .single()

    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { organization_id, bank_name } = existing as { id: string; organization_id: string; bank_name: string }
    if (!(await assertMember(supabase, organization_id, user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Soft-deactivate rather than hard delete (preserves transaction history)
    const { error } = await supabase.from("bank_accounts")
      .update({ is_active: false })
      .eq("id", id)
      .eq("organization_id", organization_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog(supabase, {
      organizationId: organization_id,
      userId: user.id,
      action: "BANK_ACCOUNT_DEACTIVATED",
      entityType: "bank_account",
      entityId: id,
      newData: { bank_name, is_active: false },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
