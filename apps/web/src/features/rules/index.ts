// ─── Services ────────────────────────────────────────────────────────────────
export {
  evaluateCondition,
  evaluateRule,
  applyActions,
  evaluateAndApply,
  type EvaluationTarget,
} from "./service"

export {
  recordCorrection,
  suggestCategory,
  suggestCategoryBySupplier,
  applySuggestions,
  getCategorizationStats,
  getCorrectionInsights,
  type RecordCorrectionParams,
  type SuggestionInput,
  type CategorySuggestion,
  type CategorizationStats,
  type CorrectionInsight,
} from "./categorization.service"

export {
  detectRecurringPatterns,
  type DetectedPattern,
} from "./pattern-detection.service"

// ─── Server Actions ──────────────────────────────────────────────────────────
export {
  getAccountOptionsAction,
  getCategoryOptionsAction,
  testRuleAction,
} from "./actions"

export {
  getSuggestionsAction,
  acceptSuggestionAction,
  dismissSuggestionAction,
} from "./actions-categorization"

export {
  getDetectedPatternsAction,
  dismissPatternAction,
  getPatternCountAction,
} from "./actions-patterns"

// ─── Hooks ───────────────────────────────────────────────────────────────────
export {
  useRules,
  useCreateRule,
  useUpdateRule,
  useDeleteRule,
  useToggleRule,
} from "./hooks"

// ─── Components ──────────────────────────────────────────────────────────────
export { RuleFormDialog } from "./components/rule-form-dialog"
export { RulesPageClient } from "./components/rules-page-client"
export { RulesTable } from "./components/rules-table"
