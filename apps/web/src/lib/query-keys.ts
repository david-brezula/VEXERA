/**
 * Central TanStack Query key factory.
 *
 * Why: Centralising keys prevents typos and makes cache invalidation
 * predictable. Invalidating queryKeys.invoices.all(orgId) busts every
 * invoice query for that org at once (list + detail).
 *
 * Usage:
 *   useQuery({ queryKey: queryKeys.invoices.list(orgId, filters) })
 *   queryClient.invalidateQueries({ queryKey: queryKeys.invoices.all(orgId) })
 */

export const queryKeys = {
  invoices: {
    /** Parent key — invalidate to bust all invoice queries for an org */
    all: (orgId: string) => ["invoices", orgId] as const,
    /** List with optional filters */
    list: (orgId: string, filters?: Record<string, unknown>) =>
      ["invoices", orgId, "list", filters] as const,
    /** Single invoice detail */
    detail: (orgId: string, id: string) => ["invoices", orgId, id] as const,
  },

  invoiceItems: {
    /** All items for an invoice */
    list: (invoiceId: string) => ["invoice-items", invoiceId] as const,
  },

  documents: {
    /** Parent key — invalidate to bust all document queries for an org */
    all: (orgId: string) => ["documents", orgId] as const,
    /** List with optional filters */
    list: (orgId: string, filters?: Record<string, unknown>) =>
      ["documents", orgId, "list", filters] as const,
    /** Single document detail */
    detail: (orgId: string, id: string) => ["documents", orgId, id] as const,
    /** Documents linked to a specific invoice */
    forInvoice: (invoiceId: string) => ["documents", "for-invoice", invoiceId] as const,
  },

  auditLogs: {
    /** Audit logs for a specific entity (e.g. one invoice) */
    forEntity: (orgId: string, entityType: string, entityId: string) =>
      ["audit-logs", orgId, entityType, entityId] as const,
  },

  dashboard: {
    stats: (orgId: string) => ["dashboard", orgId, "stats"] as const,
  },

  rules: {
    all: (orgId: string) => ["rules", orgId] as const,
    list: (orgId: string, filters?: Record<string, unknown>) =>
      ["rules", orgId, "list", filters] as const,
  },

  notifications: {
    all: (orgId: string) => ["notifications", orgId] as const,
    list: (orgId: string, filters?: Record<string, unknown>) =>
      ["notifications", orgId, "list", filters] as const,
    unreadCount: (orgId: string) => ["notifications", orgId, "unread-count"] as const,
  },

  bank: {
    /** Parent key — invalidate to bust all bank queries for an org */
    all: (orgId: string) => ["bank", orgId] as const,
    /** Bank accounts */
    accounts: (orgId: string) => ["bank", orgId, "accounts"] as const,
    /** Bank transactions with optional filters */
    transactions: (orgId: string, filters?: Record<string, unknown>) =>
      ["bank", orgId, "transactions", filters] as const,
    /** Reconciliation suggestions */
    reconciliation: (orgId: string) => ["bank", orgId, "reconciliation"] as const,
  },

  queue: {
    /** Parent key — invalidate to bust all queue queries for an org */
    all: (orgId: string) => ["queue", orgId] as const,
    /** List with optional filters */
    list: (orgId: string, filters?: Record<string, unknown>) =>
      ["queue", orgId, "list", filters] as const,
    /** Single job status */
    detail: (orgId: string, id: string) => ["queue", orgId, id] as const,
  },

  healthChecks: {
    /** Parent key */
    all: (orgId: string) => ["health-checks", orgId] as const,
    /** Latest run */
    latestRun: (orgId: string) => ["health-checks", orgId, "latest"] as const,
    /** Issues list with filters */
    issues: (orgId: string, filters?: Record<string, unknown>) =>
      ["health-checks", orgId, "issues", filters] as const,
  },

  reports: {
    /** Parent key */
    all: (orgId: string) => ["reports", orgId] as const,
    /** Category breakdown */
    categories: (orgId: string, filters?: Record<string, unknown>) =>
      ["reports", orgId, "categories", filters] as const,
    /** Client P&L */
    clientPL: (orgId: string, filters?: Record<string, unknown>) =>
      ["reports", orgId, "client-pl", filters] as const,
    /** Project P&L */
    projectPL: (orgId: string, filters?: Record<string, unknown>) =>
      ["reports", orgId, "project-pl", filters] as const,
    /** Remaining work */
    remainingWork: (orgId: string, filters?: Record<string, unknown>) =>
      ["reports", orgId, "remaining-work", filters] as const,
  },

  tags: {
    /** Parent key */
    all: (orgId: string) => ["tags", orgId] as const,
    /** Tag list */
    list: (orgId: string, filters?: Record<string, unknown>) =>
      ["tags", orgId, "list", filters] as const,
  },

  contacts: {
    /** Parent key */
    all: (orgId: string) => ["contacts", orgId] as const,
    /** Contact list */
    list: (orgId: string, filters?: Record<string, unknown>) =>
      ["contacts", orgId, "list", filters] as const,
    /** Single contact detail */
    detail: (orgId: string, id: string) => ["contacts", orgId, id] as const,
  },

  products: {
    /** Parent key */
    all: (orgId: string) => ["products", orgId] as const,
    /** Product list */
    list: (orgId: string, filters?: Record<string, unknown>) =>
      ["products", orgId, "list", filters] as const,
  },

  recurringInvoices: {
    /** Parent key */
    all: (orgId: string) => ["recurring-invoices", orgId] as const,
    /** Template list */
    list: (orgId: string, filters?: Record<string, unknown>) =>
      ["recurring-invoices", orgId, "list", filters] as const,
    /** Single template detail */
    detail: (orgId: string, id: string) => ["recurring-invoices", orgId, id] as const,
  },

  chat: {
    /** Parent key */
    all: (orgId: string) => ["chat", orgId] as const,
    /** Session list */
    sessions: (orgId: string) => ["chat", orgId, "sessions"] as const,
    /** Messages in a session */
    messages: (sessionId: string) => ["chat", "messages", sessionId] as const,
  },

  cashflowScenarios: {
    /** Parent key */
    all: (orgId: string) => ["cashflow-scenarios", orgId] as const,
    /** Scenario list */
    list: (orgId: string) => ["cashflow-scenarios", orgId, "list"] as const,
    /** Single scenario detail */
    detail: (orgId: string, id: string) => ["cashflow-scenarios", orgId, id] as const,
  },
} as const
