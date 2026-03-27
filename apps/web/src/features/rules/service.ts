/**
 * Rules Engine — pure evaluator (no DB calls, no imports from @/)
 *
 * Evaluates IF-THEN rules against a flat key-value target object.
 * Designed to run on both documents and bank transactions.
 */

import type { Rule, RuleCondition, RuleOperator } from "@vexera/types"

export interface EvaluationTarget {
  [field: string]: string | number | null | undefined
}

// ─── Condition evaluation ──────────────────────────────────────────────────────

export function evaluateCondition(
  condition: RuleCondition,
  target: EvaluationTarget
): boolean {
  const raw = target[condition.field]
  const targetVal = raw != null ? String(raw).toLowerCase() : ""
  const condVal = String(condition.value).toLowerCase()
  const op: RuleOperator = condition.operator

  switch (op) {
    case "equals":
      return targetVal === condVal
    case "not_equals":
      return targetVal !== condVal
    case "contains":
      return targetVal.includes(condVal)
    case "not_contains":
      return !targetVal.includes(condVal)
    case "starts_with":
      return targetVal.startsWith(condVal)
    case "ends_with":
      return targetVal.endsWith(condVal)
    case "gt": {
      const a = parseFloat(targetVal), b = parseFloat(condVal)
      return !isNaN(a) && !isNaN(b) && a > b
    }
    case "lt": {
      const a = parseFloat(targetVal), b = parseFloat(condVal)
      return !isNaN(a) && !isNaN(b) && a < b
    }
    case "gte": {
      const a = parseFloat(targetVal), b = parseFloat(condVal)
      return !isNaN(a) && !isNaN(b) && a >= b
    }
    case "lte": {
      const a = parseFloat(targetVal), b = parseFloat(condVal)
      return !isNaN(a) && !isNaN(b) && a <= b
    }
    default:
      return false
  }
}

// ─── Rule evaluation ───────────────────────────────────────────────────────────

export function evaluateRule(rule: Rule, target: EvaluationTarget): boolean {
  if (!rule.is_active) return false
  if (rule.conditions.length === 0) return false
  const op = rule.logic_operator ?? 'AND'
  if (op === 'OR') {
    return rule.conditions.some((c) => evaluateCondition(c, target))
  }
  return rule.conditions.every((c) => evaluateCondition(c, target))
}

// ─── Action application ────────────────────────────────────────────────────────

const ACTION_TO_COLUMN: Record<string, string> = {
  set_category: "category",
  set_account: "account_number",
  set_document_type: "document_type",
  set_tag: "tag",
}

export function applyActions(
  rule: Rule,
  _target: EvaluationTarget
): Record<string, string> {
  const patch: Record<string, string> = {}
  for (const action of rule.actions) {
    const column = ACTION_TO_COLUMN[action.type]
    if (column) {
      patch[column] = action.value
    }
  }
  return patch
}

// ─── Batch evaluation ──────────────────────────────────────────────────────────

export function evaluateAndApply(
  rules: Rule[], // already sorted by priority ASC (lower = higher priority)
  target: EvaluationTarget
): { patches: Record<string, string>; appliedRuleIds: string[] } {
  const patches: Record<string, string> = {}
  const appliedRuleIds: string[] = []

  for (const rule of rules) {
    if (evaluateRule(rule, target)) {
      const rulePatch = applyActions(rule, target)
      // Later rules (higher priority number) do NOT overwrite earlier ones
      for (const [key, value] of Object.entries(rulePatch)) {
        if (!(key in patches)) {
          patches[key] = value
        }
      }
      appliedRuleIds.push(rule.id)
    }
  }

  return { patches, appliedRuleIds }
}
