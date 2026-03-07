/**
 * GET  /api/rules — list rules for an organization
 * POST /api/rules — create a new rule
 *
 * GET query params:
 *   organization_id — required
 *   target_entity   — optional filter: "document" | "bank_transaction"
 *   active_only     — "true" to return only active rules (default: all)
 *
 * POST body (JSON):
 *   {
 *     organization_id: string
 *     name:            string
 *     description?:    string
 *     is_active?:      boolean   // default true
 *     priority?:       number    // default 100 (lower = applied first)
 *     target_entity:   "document" | "bank_transaction"
 *     conditions:      RuleCondition[]
 *     actions:         RuleAction[]
 *   }
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/services/audit.server"
import type { RuleOperator, RuleActionType } from "@vexera/types"

// ─── Validation schemas ───────────────────────────────────────────────────────

const OperatorSchema: z.ZodType<RuleOperator> = z.enum([
  "equals", "not_equals",
  "contains", "not_contains",
  "starts_with", "ends_with",
  "gt", "lt", "gte", "lte",
])

const ActionTypeSchema: z.ZodType<RuleActionType> = z.enum([
  "set_category",
  "set_account",
  "set_document_type",
  "set_tag",
])

const ConditionSchema = z.object({
  field: z.string().min(1),
  operator: OperatorSchema,
  value: z.union([z.string(), z.number()]),
})

const ActionSchema = z.object({
  type: ActionTypeSchema,
  value: z.string().min(1),
})

const CreateRuleSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  is_active: z.boolean().default(true),
  priority: z.number().int().min(1).max(9999).default(100),
  target_entity: z.enum(["document", "bank_transaction"]),
  conditions: z.array(ConditionSchema).min(1, "At least one condition is required"),
  actions: z.array(ActionSchema).min(1, "At least one action is required"),
})

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

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    let query = supabase
      .from("rules")
      .select("id, name, description, is_active, priority, target_entity, conditions, actions, applied_count, last_applied_at, created_by, created_at, updated_at")
      .eq("organization_id", organizationId)
      .order("priority", { ascending: true })
      .order("created_at", { ascending: true })

    const targetEntity = url.searchParams.get("target_entity")
    if (targetEntity) query = query.eq("target_entity", targetEntity)

    if (url.searchParams.get("active_only") === "true") {
      query = query.eq("is_active", true)
    }

    const { data, error } = await query
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
    const parsed = CreateRuleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }
    const { organization_id, ...fields } = parsed.data

    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organization_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.from("rules" as any) as any)
      .insert({
        organization_id,
        created_by: user.id,
        ...fields,
      })
      .select("id, name, description, is_active, priority, target_entity, conditions, actions, created_at")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog(supabase, {
      organizationId: organization_id,
      userId: user.id,
      action: "RULE_CREATED",
      entityType: "rule",
      entityId: (data as { id: string }).id,
      newData: {
        name: fields.name,
        target_entity: fields.target_entity,
        conditions_count: fields.conditions.length,
        actions_count: fields.actions.length,
      },
    })

    return NextResponse.json({ data }, { status: 201 })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
