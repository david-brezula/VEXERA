// ─── Bank feature barrel export ─────────────────────────────────────────────

// Services
export { parseBankStatement, parseCsv, parseMt940 } from "./service"
export type { BankTransactionRow, ParseResult } from "./service"

export { reconcile, acceptMatch } from "./reconciliation.service"
export type {
  MatchConfidence,
  ReconcileMatch,
  ReconcileResult as ReconcileServiceResult,
} from "./reconciliation.service"

// Hooks
export {
  useBankAccounts,
  useBankTransactions,
  useBankImport,
  useRunReconciliation,
  useManualMatch,
  useIgnoreTransaction,
} from "./hooks"
export type {
  BankTransactionFilters,
  ImportResult,
  ReconcileResult,
} from "./hooks"

// Components
export { BankPageClient } from "./components/bank-page-client"
export { BankImportWizard } from "./components/bank-import-wizard"
export { BankTransactionsTable } from "./components/bank-transactions-table"
export { ReconcileSuggestionsPanel } from "./components/reconcile-suggestions-panel"
export { RecurringPatternsPanel } from "./components/recurring-patterns-panel"
