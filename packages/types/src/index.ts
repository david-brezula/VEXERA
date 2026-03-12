export type { Database, Json } from './database.types'

// Domain types — shared across apps and packages

export type OrganizationRole = 'owner' | 'admin' | 'member'

export type InvoiceType = 'issued' | 'received' | 'credit_note'

export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue' | 'cancelled' | 'closed'

export type PaymentMethod = 'bank_transfer' | 'cash' | 'card' | 'other'

export type DocumentType =
  | 'invoice_issued'
  | 'invoice_received'
  | 'receipt'
  | 'contract'
  | 'bank_statement'
  | 'tax_document'
  | 'other'

export type LedgerEntryStatus = 'draft' | 'posted' | 'reversed'

export type AccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense' | 'off_balance'

export type SubscriptionPlan =
  | 'free'
  | 'freelancer'
  | 'small_business'
  | 'medium_business'
  | 'accounting_firm'

export type SubscriptionStatus = 'active' | 'past_due' | 'cancelled' | 'trialing' | 'incomplete'

export type InvitationRole = 'accountant' | 'admin' | 'member'

export type InvitationStatus = 'pending' | 'accepted' | 'expired' | 'revoked'

export type AccountantClientStatus = 'pending' | 'active' | 'revoked'

export type OrganizationType = 'freelancer' | 'company' | 'accounting_firm'
export type TaxRegime = 'pausalne_vydavky' | 'naklady'
export type DphStatus = 'platca' | 'neplatca'

export interface FreelancerProfile {
  id: string
  organization_id: string
  ico: string | null
  tax_regime: TaxRegime
  registered_dph: boolean
  created_at: string
}

export interface CompanyProfile {
  id: string
  organization_id: string
  ico: string | null
  ic_dph: string | null
  dph_status: DphStatus
  created_at: string
}

export interface AccountingFirmProfile {
  id: string
  organization_id: string
  referral_code: string
  created_at: string
}

export type OcrStatus = 'not_queued' | 'queued' | 'processing' | 'done' | 'failed'

export type DocumentStatus =
  | 'new'
  | 'auto_processed'
  | 'awaiting_review'
  | 'approved'
  | 'awaiting_client'
  | 'archived'

export type PeppolStatus = 'not_sent' | 'pending' | 'delivered' | 'failed'

export interface AccountantPermissions {
  view_invoices: boolean
  close_invoices: boolean
  manage_ledger: boolean
  view_documents: boolean
  upload_documents: boolean
}

// Slovak VAT rates
export const VAT_RATES = [20, 10, 5, 0] as const
export type VatRate = (typeof VAT_RATES)[number]

// Bank
export type BankTransactionMatchStatus =
  | 'unmatched'
  | 'matched'
  | 'manually_matched'
  | 'ignored'

export interface BankTransaction {
  id: string
  organization_id: string
  bank_account_id: string
  transaction_date: string       // ISO date YYYY-MM-DD
  amount: number                  // positive = credit, negative = debit
  currency: string
  variable_symbol: string | null
  constant_symbol: string | null
  specific_symbol: string | null
  description: string | null
  counterpart_iban: string | null
  counterpart_name: string | null
  match_status: BankTransactionMatchStatus
  matched_invoice_id: string | null
  matched_at: string | null
  matched_by: string | null
  source_file_name: string | null
  source_file_checksum: string | null
  external_id: string | null
  created_at: string
  updated_at: string
}

export interface BankAccount {
  id: string
  organization_id: string
  bank_name: string
  iban: string
  swift: string | null
  currency: string
  account_holder: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// Rules engine
export type RuleTargetEntity = 'document' | 'bank_transaction'
export type RuleOperator =
  | 'equals' | 'not_equals'
  | 'contains' | 'not_contains'
  | 'starts_with' | 'ends_with'
  | 'gt' | 'lt' | 'gte' | 'lte'

export type RuleActionType =
  | 'set_category'
  | 'set_account'
  | 'set_document_type'
  | 'set_tag'

export interface RuleCondition {
  field: string
  operator: RuleOperator
  value: string | number
}

export interface RuleAction {
  type: RuleActionType
  value: string
}

export interface Rule {
  id: string
  organization_id: string
  name: string
  description: string | null
  is_active: boolean
  priority: number
  target_entity: RuleTargetEntity
  conditions: RuleCondition[]
  actions: RuleAction[]
  applied_count: number
  last_applied_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

// Email integration
export interface EmailConnection {
  id: string
  organization_id: string
  created_by: string | null
  email_address: string
  google_user_id: string
  access_token: string
  refresh_token: string
  token_expires_at: string   // ISO timestamp
  is_active: boolean
  last_polled_at: string | null
  last_error: string | null
  created_at: string
  updated_at: string
}

export interface EmailImport {
  id: string
  organization_id: string
  email_connection_id: string
  gmail_message_id: string
  gmail_thread_id: string | null
  subject: string | null
  sender: string | null
  received_at: string | null
  attachments_found: number
  documents_created: number
  processed_at: string
  error_message: string | null
  created_at: string
}

// Notifications
export type NotificationType =
  | 'invoice_overdue'
  | 'document_ocr_done'
  | 'document_ocr_failed'
  | 'bank_import_done'
  | 'reconciliation_match'
  | 'rule_applied'
  | 'export_ready'
  | 'system'

export interface Notification {
  id: string
  organization_id: string
  user_id: string
  type: NotificationType | string
  title: string
  body: string | null
  entity_type: string | null
  entity_id: string | null
  metadata: Record<string, unknown> | null
  is_read: boolean
  read_at: string | null
  created_at: string
}

export interface CreateNotificationParams {
  organizationId: string
  userId: string
  type: NotificationType | string
  title: string
  body?: string
  entityType?: string
  entityId?: string
  metadata?: Record<string, unknown>
}

// Export jobs
export type ExportFormat = 'pohoda' | 'money_s3' | 'kros' | 'csv_generic'
export type ExportJobStatus = 'pending' | 'processing' | 'done' | 'failed'

export interface ExportJob {
  id: string
  organization_id: string
  created_by: string | null
  format: ExportFormat
  period_from: string   // ISO date
  period_to: string     // ISO date
  include_types: string[]
  status: ExportJobStatus
  started_at: string | null
  completed_at: string | null
  error_message: string | null
  file_path: string | null
  row_count: number | null
  created_at: string
  updated_at: string
}

// ExportAdapter is defined in apps/web/src/lib/services/export/export.adapter.ts

// ─── OCR ──────────────────────────────────────────────────────────────────────

export interface OcrExtractedFields {
  supplier_name: string | null
  document_number: string | null
  issue_date: string | null       // ISO date
  due_date: string | null         // ISO date
  total_amount: number | null
  vat_amount: number | null
  vat_rate: number | null
  currency: string | null
  iban: string | null
  variable_symbol: string | null
  raw_text: string | null
}

// ─── Document Corrections (smart categorization) ─────────────────────────────

export interface DocumentCorrection {
  id: string
  organization_id: string
  document_id: string
  user_id: string | null
  field_name: string
  old_value: string | null
  new_value: string
  source: 'ocr' | 'rule' | 'manual'
  created_at: string
}

// ─── Recurring Patterns (cash flow) ──────────────────────────────────────────

export type CashFlowDirection = 'inflow' | 'outflow'

export interface RecurringPattern {
  id: string
  organization_id: string
  counterpart_name: string | null
  counterpart_iban: string | null
  typical_amount: number
  amount_stddev: number
  currency: string
  direction: CashFlowDirection
  frequency_days: number
  last_seen_at: string | null
  next_expected_at: string | null
  occurrence_count: number
  is_active: boolean
  category: string | null
  created_at: string
  updated_at: string
}

export interface CashFlowForecastPoint {
  date: string           // ISO date
  projected_balance: number
  inflows: number
  outflows: number
  items: CashFlowItem[]
}

export interface CashFlowItem {
  description: string
  amount: number
  direction: CashFlowDirection
  source: 'invoice' | 'recurring' | 'scheduled'
  confidence: number    // 0-1
}

// ─── VAT Returns ─────────────────────────────────────────────────────────────

export type VatReturnStatus = 'draft' | 'final' | 'submitted'

export interface VatReturn {
  id: string
  organization_id: string
  period_year: number
  period_quarter: number
  vat_output_20: number
  vat_output_10: number
  vat_output_5: number
  vat_input_20: number
  vat_input_10: number
  vat_input_5: number
  total_output_vat: number
  total_input_vat: number
  vat_liability: number
  taxable_base_output: number
  taxable_base_input: number
  status: VatReturnStatus
  document_count: number
  computed_at: string
  finalized_at: string | null
  finalized_by: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

// ─── Document Comments ───────────────────────────────────────────────────────

export interface DocumentComment {
  id: string
  document_id: string
  organization_id: string
  user_id: string | null
  content: string
  created_at: string
  // Joined from profiles
  user_name?: string
  user_email?: string
}

// ─── Accountant Dashboard ────────────────────────────────────────────────────

export interface ClientSummary {
  organization_id: string
  organization_name: string
  unprocessed_docs: number
  auto_processed_docs: number
  total_docs: number
  auto_process_rate: number      // 0-100 percentage
  unmatched_transactions: number
  last_activity_at: string | null
  days_since_activity: number
  status: 'needs_attention' | 'on_track' | 'idle'
}

export interface AccountantDashboardData {
  clients: ClientSummary[]
  total_clients: number
  total_unprocessed: number
  total_auto_processed: number
  overall_auto_rate: number
  docs_processed_this_week: number
  estimated_hours_saved: number
  referral_code: string | null
}

// ─── Duplicate Detection ─────────────────────────────────────────────────────

export interface DuplicateCandidate {
  document_id: string
  document_name: string
  match_score: number    // 0-1
  match_reason: string   // e.g. 'Same file hash', 'Same supplier + amount + date'
  created_at: string
}
