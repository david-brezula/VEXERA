import { z } from "zod"

export const ruleConditionSchema = z.object({
  field: z.string().min(1, { error: "Field is required" }),
  operator: z.enum([
    "equals", "not_equals",
    "contains", "not_contains",
    "starts_with", "ends_with",
    "gt", "lt", "gte", "lte",
  ]),
  value: z.string().min(1, { error: "Value is required" }),
})

export const ruleActionSchema = z.object({
  type: z.enum(["set_category", "set_account", "set_document_type", "set_tag"]),
  value: z.string().min(1, { error: "Value is required" }),
})

export const ruleFormSchema = z.object({
  name: z.string().min(1, { error: "Name is required" }).max(200),
  description: z.string().max(1000).optional(),
  target_entity: z.enum(["document", "bank_transaction"]),
  priority: z.coerce.number().int().min(1).max(9999),
  conditions: z.array(ruleConditionSchema).min(1, { error: "At least one condition is required" }),
  actions: z.array(ruleActionSchema).min(1, { error: "At least one action is required" }),
})

export type RuleFormValues = z.infer<typeof ruleFormSchema>
