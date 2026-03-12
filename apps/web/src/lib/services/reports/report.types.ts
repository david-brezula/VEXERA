/**
 * Shared types for the reporting engine.
 */

export interface ReportPeriod {
  from: string  // YYYY-MM-DD
  to: string    // YYYY-MM-DD
}

export interface CategoryBreakdownRow {
  category: string
  totalAmount: number
  transactionCount: number
  percentage: number
  documentIds: string[]
}

export interface CategoryBreakdown {
  period: ReportPeriod
  currency: string
  totalExpenses: number
  totalRevenue: number
  expensesByCategory: CategoryBreakdownRow[]
  revenueByCategory: CategoryBreakdownRow[]
}

export interface PLRow {
  label: string
  amount: number
  transactionCount: number
  percentage: number
}

export interface PLReport {
  period: ReportPeriod
  currency: string
  entityType: "client" | "project"
  entityName: string
  entityTagId: string
  revenue: PLRow[]
  expenses: PLRow[]
  totalRevenue: number
  totalExpenses: number
  netProfit: number
  margin: number  // percentage
}

export interface RemainingWorkClient {
  organizationId: string
  organizationName: string
  unprocessedDocuments: number
  unmatchedTransactions: number
  unapprovedInvoices: number
  healthCheckIssues: number
  readinessPercent: number
}

export interface RemainingWorkReport {
  deadline: string
  deadlineLabel: string
  daysUntil: number
  clients: RemainingWorkClient[]
  overallReadiness: number
}
