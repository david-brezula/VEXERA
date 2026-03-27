/**
 * GET    /api/rules/[id] — get a single rule
 * PATCH  /api/rules/[id] — update rule fields
 * DELETE /api/rules/[id] — delete a rule
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/shared/services/audit.server"
import type { RuleOperator, RuleActionType } from "@vexera/types"

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
  field: z.string().min(1).max(100),
  operator: OperatorSchema,
  value: z.union([z.string().max(500), z.number()]),
})

const ActionSchema = z.object({
  type: ActionTypeSchema,
  value: z.string().min(1).max(500),
})

const UpdateRuleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).nullable().optional(),
  is_active: z.boolean().optional(),
  priority: z.number().int().min(1).max(9999).optional(),
  target_entity: z.enum(["document", "bank_transaction"]).optional(),
  logic_operator: z.enum(["AND", "OR"]).optional(),
  conditions: z.array(ConditionSchema).min(1).optional(),
  actions: z.array(ActionSchema).min(1).optional(),
})

type Params = { params: Promise<{ id: string }> }

// ─── Shared: verify rule ownership ───────────────────────────────────────────

async function getRuleWithOrgCheck(
  supabase: Awaited<ReturnType<typeof createClient>>,
  ruleId: string,
  userId: string
) {
  const { data: rule } = await supabase
    .from("rules")
    .select("id, organization_id, name, target_entity")
    .eq("id", ruleId)
    .single()

  if (!rule) return null

  const { organization_id } = rule as { id: string; organization_id: string; name: string; target_entity: string }

  const { data: membership } = await supabase
    .from("organization_members")
    .select("id")
    .eq("organization_id", organization_id)
    .eq("user_id", userId)
    .single()

  if (!membership) return null

  return rule as { id: string; organization_id: string; name: string; target_entity: string }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rule = await getRuleWithOrgCheck(supabase, id, user.id)
    if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { data, error } = await supabase
      .from("rules")
      .select("*")
      .eq("id", id)
      .single()

    if (error || !data) return NextResponse.json({ error: "Not found" }, { status: 404 })
    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(request: Request, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rule = await getRuleWithOrgCheck(supabase, id, user.id)
    if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const body = await request.json()
    const parsed = UpdateRuleSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    }

    const { data, error } = await supabase.from("rules")
      .update(parsed.data)
      .eq("id", id)
      .eq("organization_id", rule.organization_id)
      .select("id, name, description, is_active, priority, target_entity, logic_operator, conditions, actions, updated_at")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog(supabase, {
      organizationId: rule.organization_id,
      userId: user.id,
      action: "RULE_UPDATED",
      entityType: "rule",
      entityId: id,
      newData: parsed.data,
    })

    return NextResponse.json({ data })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const { id } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const rule = await getRuleWithOrgCheck(supabase, id, user.id)
    if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 })

    const { error } = await supabase
      .from("rules")
      .delete()
      .eq("id", id)
      .eq("organization_id", rule.organization_id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    await writeAuditLog(supabase, {
      organizationId: rule.organization_id,
      userId: user.id,
      action: "RULE_DELETED",
      entityType: "rule",
      entityId: id,
      newData: { name: rule.name, target_entity: rule.target_entity },
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Internal error" }, { status: 500 })
  }
}
