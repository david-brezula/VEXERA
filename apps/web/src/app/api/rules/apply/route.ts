/**
 * POST /api/rules/apply
 *
 * Apply active rules to one or more entities (documents or bank transactions).
 * Evaluates all active rules in priority order and writes patches to the DB.
 * Logs each application to rule_applications for auditing.
 *
 * Body (JSON):
 *   {
 *     organization_id: string             // UUID
 *     target_entity:   "document" | "bank_transaction"
 *     entity_ids:      string[]           // UUIDs of entities to process
 *   }
 *
 * Returns 200:
 *   {
 *     processed: number                   // entities evaluated
 *     patched:   number                   // entities with at least one change applied
 *     results: Array<{
 *       entity_id:       string
 *       applied_rule_ids: string[]
 *       patches:         Record<string, string>
 *     }>
 *   }
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { evaluateAndApply } from "@/lib/services/rules-engine.service"
import { writeAuditLog } from "@/lib/services/audit.server"
import type { Rule } from "@vexera/types"

const ApplySchema = z.object({
  organization_id: z.string().uuid(),
  target_entity: z.enum(["document", "bank_transaction"]),
  entity_ids: z.array(z.string().uuid()).min(1).max(200),
})

// ─── Flatten a DB row into a flat key-value target for the rules engine ───────

function flattenDocument(row: Record<string, unknown>) {
  return {
    name: String(row.name ?? ""),
    document_type: String(row.document_type ?? ""),
    mime_type: String(row.mime_type ?? ""),
    supplier_name: String((row.ocr_data as Record<string, unknown> | null)?.supplier_name ?? ""),
    invoice_number: String((row.ocr_data as Record<string, unknown> | null)?.invoice_number ?? ""),
    total: Number((row.ocr_data as Record<string, unknown> | null)?.total ?? 0),
  }
}

function flattenTransaction(row: Record<string, unknown>) {
  return {
    description: String(row.description ?? ""),
    counterpart_name: String(row.counterpart_name ?? ""),
    counterpart_iban: String(row.counterpart_iban ?? ""),
    variable_symbol: String(row.variable_symbol ?? ""),
    amount: Number(row.amount ?? 0),
    currency: String(row.currency ?? "EUR"),
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await request.json()
    const parsed = ApplySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { organization_id, target_entity, entity_ids } = parsed.data

    // Membership guard
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // Fetch active rules sorted by priority ASC (lower number = applied first)
    const { data: rulesRaw, error: rulesErr } = await supabase
      .from("rules")
      .select("id, name, is_active, priority, target_entity, conditions, actions")
      .eq("organization_id", organization_id)
      .eq("target_entity", target_entity)
      .eq("is_active", true)
      .order("priority", { ascending: true })

    if (rulesErr) return NextResponse.json({ error: rulesErr.message }, { status: 500 })
    const rules = (rulesRaw ?? []) as unknown as Rule[]

    if (rules.length === 0) {
      return NextResponse.json({
        processed: 0,
        patched: 0,
        results: [],
        message: `No active rules for ${target_entity}`,
      })
    }

    // Fetch the target entities
    const table = target_entity === "document" ? "documents" : "bank_transactions"
    const { data: entities, error: entErr } = await supabase
      .from(table)
      .select("*")
      .eq("organization_id", organization_id)
      .in("id", entity_ids)

    if (entErr) return NextResponse.json({ error: entErr.message }, { status: 500 })
    if (!entities || entities.length === 0) {
      return NextResponse.json({ processed: 0, patched: 0, results: [] })
    }

    // Evaluate + apply rules for each entity
    const results = []
    let patchedCount = 0

    for (const entity of entities as Array<Record<string, unknown> & { id: string }>) {
      const target =
        target_entity === "document"
          ? flattenDocument(entity)
          : flattenTransaction(entity)

      const { patches, appliedRuleIds } = evaluateAndApply(rules, target)

      if (Object.keys(patches).length === 0) {
        results.push({ entity_id: entity.id, applied_rule_ids: [], patches: {} })
        continue
      }

      // Write patches to DB (table is "documents" or "bank_transactions" — both known types)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error: updateErr } = await (supabase.from(table as any) as any)
        .update(patches)
        .eq("id", entity.id)
        .eq("organization_id", organization_id)

      if (updateErr) {
        results.push({ entity_id: entity.id, applied_rule_ids: [], patches: {}, error: updateErr.message })
        continue
      }

      patchedCount++

      // Log each applied rule to rule_applications + stamp last_applied_at
      const now = new Date().toISOString()
      for (const ruleId of appliedRuleIds) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("rule_applications" as any) as any).insert({
          rule_id: ruleId,
          organization_id,
          entity_type: target_entity,
          entity_id: entity.id,
          actions_applied: patches,
        })

        // Stamp last_applied_at (best-effort — no RPC needed)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from("rules" as any) as any)
          .update({ last_applied_at: now })
          .eq("id", ruleId)
      }

      results.push({ entity_id: entity.id, applied_rule_ids: appliedRuleIds, patches })
    }

    await writeAuditLog(supabase, {
      organizationId: organization_id,
      userId: user.id,
      action: "RULE_APPLIED",
      entityType: target_entity === "document" ? "document" : "bank_transaction",
      newData: {
        target_entity,
        entity_count: entities.length,
        patched_count: patchedCount,
        rules_evaluated: rules.length,
      },
    })

    return NextResponse.json({
      processed: entities.length,
      patched: patchedCount,
      results,
    })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
