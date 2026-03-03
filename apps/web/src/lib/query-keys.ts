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
} as const
