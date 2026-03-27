// ─── Actions ─────────────────────────────────────────────────────────────────
export {
  exportKvDphAction,
  exportDpDphAction,
  exportIncomeTaxAction,
  exportPeppolUblAction,
} from "./actions"

export {
  exportCategoryReportPdfAction,
  exportPLReportPdfAction,
  exportCashflowReportPdfAction,
  exportRemainingWorkReportPdfAction,
  exportCategoryReportExcelAction,
  exportPLReportExcelAction,
} from "./actions-report"

// ─── Services ────────────────────────────────────────────────────────────────
export { getExportAdapter } from "./services"
export type { ExportAdapter, ExportRow, ExportResult } from "./services"
export { generateExcelCSV, generateReportExcel } from "./services/excel.adapter"
export type { ExcelColumn } from "./services/excel.adapter"
export { generatePDFHtml } from "./services/pdf-report.adapter"
export type { PDFSection, PDFTableContent, PDFSummaryContent } from "./services/pdf-report.adapter"
export { generateAuditBundle } from "./services/audit-bundle.service"
export type { AuditBundle, AuditBundleFile, AuditBundleManifest } from "./services/audit-bundle.service"

// ─── XML generators ──────────────────────────────────────────────────────────
export { generateKvDphXml } from "./xml/kv-dph"
export type { KvDphInvoice, KvDphInput } from "./xml/kv-dph"
export { generateDpDphXml } from "./xml/dp-dph"
export type { DpDphInput } from "./xml/dp-dph"
export { generateDpTypeBXml } from "./xml/dp-type-b"
export type { DpTypeBInput } from "./xml/dp-type-b"
export { generateUblInvoiceXml } from "./xml/peppol-ubl"
export type { UblInvoiceInput } from "./xml/peppol-ubl"
export { parseUblInvoiceXml } from "./xml/parse-ubl"
export type { ParsedInvoice } from "./xml/parse-ubl"
export { parseCiiInvoiceXml } from "./xml/parse-cii"

// ─── Components ──────────────────────────────────────────────────────────────
export { ExportPageClient } from "./components/export-page-client"
