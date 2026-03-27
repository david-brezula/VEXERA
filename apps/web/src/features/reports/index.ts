// ─── Actions ─────────────────────────────────────────────────────────────────
export {
  listScenariosAction,
  createScenarioAction,
  deleteScenarioAction,
} from "./cashflow/actions"

export {
  computeVatReturnAction,
  getVatReturnsAction,
  getVatReturnDetailAction,
  finalizeVatReturnAction,
  revertVatReturnAction,
  markVatReturnSubmittedAction,
  updateVatReturnNotesAction,
  getOrgFilingFrequencyAction,
} from "./vat/actions"

export { getDrilldownDocumentsAction } from "./actions-drilldown"

export {
  getActiveVatRatesAction,
  getUpcomingDeadlinesAction,
  getFilingRequirementsAction,
} from "./actions-legislative"

// ─── Services ────────────────────────────────────────────────────────────────
export {
  calculateVatReturn,
  getCurrentMonthVat,
  calculateQuarterVatReturn,
  getVatTimeline as getVatTimelineService,
} from "./vat/service"

export {
  detectRecurringPatterns,
  forecast,
  getCashFlowSummary,
} from "./cashflow/service"
export type { CashFlowSummary as CashFlowSummaryService } from "./cashflow/service"

export {
  listScenarios,
  createScenario,
  updateScenario,
  deleteScenario,
  applyScenarioAdjustments,
  compareScenarios,
} from "./cashflow/scenarios.service"
export type {
  CashflowScenario,
  CreateScenarioInput,
  ScenarioAdjustment,
  ScenarioForecastPoint,
} from "./cashflow/scenarios.service"

export {
  runHealthChecks,
  calculateRiskScore,
  getLatestHealthCheckRun,
  getHealthCheckIssues,
  resolveHealthCheckIssue,
} from "./health-checks/service"

export { trackEvent, getFeatureUsageStats } from "./analytics.service"

// ─── Report Services ─────────────────────────────────────────────────────────
export { getCachedOrGenerate } from "./services/report-cache"
export { generateCategoryReport } from "./services/category-report.service"
export { generateTagPL, generateAllTagsPLSummary } from "./services/client-project-pl.service"
export { generateRemainingWork } from "./services/remaining-work.service"
export type {
  ReportPeriod,
  CategoryBreakdown,
  CategoryBreakdownRow,
  PLReport,
  PLRow,
  RemainingWorkClient,
  RemainingWorkReport,
} from "./services/report.types"

// ─── Data ────────────────────────────────────────────────────────────────────
export { getCurrentQuarterVat, getVatTimeline } from "./vat/data"
export type { VatSummary, VatTimelinePoint } from "./vat/data"

export { getCashFlowData } from "./cashflow/data"
export type { CashFlowPoint, RecurringPatternRow } from "./cashflow/data"
export type { CashFlowSummary as CashFlowSummaryData } from "./cashflow/data"

export { getDashboardStats } from "./dashboard/data"
export type { DashboardStats } from "./dashboard/data"

export { getAccountantDashboard } from "./dashboard/accountant-data"
export { getAccountantNeeds } from "./dashboard/accountant-needs"
export type { AccountantNeed, AccountantNeedsSummary } from "./dashboard/accountant-needs"

export { getFinancialStats } from "./dashboard/financial-stats"
export type { FinancialStats, MonthlyRow } from "./dashboard/financial-stats"

export { getFreelancerTaxData } from "./tax/freelancer-data"
export type { FreelancerTaxData } from "./tax/freelancer-data"

export { getIncomeTaxDataAction } from "./tax/income-data"
export type { IncomeTaxData } from "./tax/income-data"

// ─── Hooks ───────────────────────────────────────────────────────────────────
export { useCategoryReport } from "./hooks"
export {
  useHealthChecks,
  useRunHealthCheck,
  useResolveIssue,
} from "./health-checks/hooks"
export type {
  HealthCheckRun,
  HealthCheckIssue,
} from "./health-checks/hooks"

// ─── Components ──────────────────────────────────────────────────────────────
export { AccountantDashboard } from "./dashboard/components/accountant-dashboard"
export { AccountantNeedsWidget } from "./dashboard/components/accountant-needs-widget"
export { CashFlowWidget } from "./dashboard/components/cashflow-widget"
export { FinancialOverview } from "./dashboard/components/financial-overview"
export { FreelancerDashboard } from "./dashboard/components/freelancer-dashboard"
export { VatWidget } from "./dashboard/components/vat-widget"

export { CashflowPageClient } from "./components/cashflow-page-client"
export { CategoriesPageClient } from "./components/categories-page-client"
export { CategorizationInsights } from "./components/categorization-insights"
export { CategoryTable } from "./components/category-table"
export { PeriodSelector, periodOptions } from "./components/period-selector"
export { PLPageClient } from "./components/pl-page-client"
export { RemainingWorkPageClient } from "./components/remaining-work-page-client"
export { RemainingWorkTable } from "./components/remaining-work-table"

export { HealthCheckSummary } from "./health-checks/components/health-check-summary"
export { HealthChecksPageClient } from "./health-checks/components/health-checks-page-client"
export { IssueList } from "./health-checks/components/issue-list"
export { RiskScoreBadge } from "./health-checks/components/risk-score-badge"
