/**
 * ExportAdapter — pluggable interface for accounting export formats.
 *
 * Each adapter receives normalized ExportRow data and returns a
 * complete file payload (content + filename + mimeType + rowCount).
 *
 * Supported formats:
 *   - Pohoda XML  (pohoda.adapter.ts)
 *   - Money S3 CSV (money-s3.adapter.ts)
 *   - Generic CSV  (generic-csv.adapter.ts)
 */

/**
 * Normalized row that every adapter consumes.
 * Built from documents.ocr_data JSONB in the Edge Function.
 */
export interface ExportRow {
  /** UUID of the source document or invoice */
  id: string
  /** ISO date YYYY-MM-DD */
  date: string
  type: 'invoice_issued' | 'invoice_received' | 'receipt' | 'other'
  document_number: string | null
  supplier_name: string | null
  customer_name: string | null
  amount_excl_vat: number
  vat_amount: number
  amount_incl_vat: number
  currency: string
  vat_rate: number
  account_number: string | null
  category: string | null
  description: string | null
}

/**
 * What every adapter must return after generating the file.
 */
export interface ExportResult {
  /** Full file content as a string (XML or CSV) */
  content: string
  /** Suggested filename including extension */
  filename: string
  /** MIME type for Content-Type header and S3 metadata */
  mimeType: string
  /** Total number of rows included in the export */
  rowCount: number
}

/**
 * The pluggable adapter interface every format must implement.
 */
export interface ExportAdapter {
  /** Identifies which ExportFormat this adapter handles */
  format: string
  /**
   * Generate the full export file from normalized rows.
   * @param rows       Normalized accounting rows
   * @param periodFrom ISO date string YYYY-MM-DD
   * @param periodTo   ISO date string YYYY-MM-DD
   * @returns          ExportResult with file content + metadata
   */
  generate(rows: ExportRow[], periodFrom: string, periodTo: string): ExportResult
}
