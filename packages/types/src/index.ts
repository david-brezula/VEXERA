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
