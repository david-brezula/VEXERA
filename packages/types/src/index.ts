export type { Database, Json } from './database.types'

// Domain types — shared across apps and packages

export type OrganizationRole = 'owner' | 'admin' | 'member'

export type InvoiceType = 'issued' | 'received'

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

export type OcrStatus = 'not_queued' | 'queued' | 'processing' | 'done' | 'failed'

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
