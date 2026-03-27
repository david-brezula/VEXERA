// ─── Types & Schemas ─────────────────────────────────────────────────────────
export type {
  InvoiceNumberingFormat,
  InvoiceTemplateSettings,
} from "./types"
export {
  DEFAULT_NUMBERING_FORMAT,
  DEFAULT_TEMPLATE_SETTINGS,
} from "./types"

export type {
  InvoiceFormValues,
  InvoiceItemFormValues,
} from "./schemas"
export {
  invoiceSchema,
  invoiceItemSchema,
  DEFAULT_VAT_RATE,
  getAvailableVatRates,
  getDefaultVatRate,
  orgToInvoiceDefaults,
  defaultInvoiceValues,
} from "./schemas"

// ─── Data ────────────────────────────────────────────────────────────────────
export type {
  InvoiceDetail,
  InvoiceRow,
  InvoiceFilters,
} from "./data"
export {
  getInvoices,
  getInvoice,
} from "./data"

// ─── Actions ─────────────────────────────────────────────────────────────────
export {
  createInvoiceAction,
  updateInvoiceAction,
  updateInvoiceStatusAction,
  deleteInvoiceAction,
  createCreditNoteAction,
  sendInvoiceEmailAction,
  getNextInvoiceNumberAction,
} from "./actions"

export {
  getInvoiceTemplateSettingsAction,
  updateInvoiceTemplateSettingsAction,
} from "./actions-template"

export { encodePayBySquareAction } from "./actions-qr"
export { importEInvoiceAction } from "./actions-e-invoice"

// ─── Services ────────────────────────────────────────────────────────────────
export { sendInvoiceEmailSystem } from "./email.service"
export {
  recordPayment,
  getPaymentHistory,
  checkOverpayment,
} from "./payment.service"
export type { InvoicePayment, RecordPaymentInput } from "./payment.service"
export {
  createTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
  generateInvoiceFromTemplate,
  processRecurringInvoices,
} from "./recurring.service"
export type {
  Frequency,
  TemplateItem,
  RecurringInvoiceTemplate,
  CreateTemplateInput,
} from "./recurring.service"

// ─── Hooks ───────────────────────────────────────────────────────────────────
export {
  useRecurringInvoices,
  useCreateRecurringInvoice,
  useToggleRecurringInvoice,
  useDeleteRecurringInvoice,
} from "./hooks-recurring"

// ─── Components ──────────────────────────────────────────────────────────────
export { ContactPicker } from "./components/contact-picker"
export { EmailTrackingBadge } from "./components/email-tracking-badge"
export { ExportUblButton } from "./components/export-ubl-button"
export { ImportEInvoiceDialog } from "./components/import-einvoice-dialog"
export { InvoiceActionsBar } from "./components/invoice-actions"
export { InvoiceDocumentsTab } from "./components/invoice-documents-tab"
export { InvoiceFilters as InvoiceFiltersComponent } from "./components/invoice-filters"
export { InvoiceForm } from "./components/invoice-form"
export { InvoiceItemsEditor } from "./components/invoice-items-editor"
export { InvoicePdfDocument } from "./components/invoice-pdf"
export { InvoiceStatusBadge } from "./components/invoice-status-badge"
export { InvoiceTableClient } from "./components/invoice-table-client"
export { PaymentHistory } from "./components/payment-history"
export { ProductPicker } from "./components/product-picker"
export { QrPaymentCode } from "./components/qr-payment-code"
export { RecurringPageClient } from "./components/recurring-page-client"
export { RecurringTemplateTable } from "./components/recurring-template-table"
export { SendEmailDialog } from "./components/send-email-dialog"
