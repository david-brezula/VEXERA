/**
 * Generic CSV Adapter
 *
 * Fallback adapter that produces a standard comma-delimited CSV file
 * with English headers. Compatible with Excel, Google Sheets, and any
 * general-purpose spreadsheet application.
 *
 * Headers:
 *   date,type,document_number,supplier_name,customer_name,
 *   amount_excl_vat,vat_rate,vat_amount,amount_incl_vat,
 *   currency,category,description
 *
 * Numbers use period (.) as decimal separator.
 * Fields containing commas, quotes, or newlines are wrapped in double quotes.
 */

import type { ExportAdapter, ExportRow, ExportResult } from './export.adapter'

/** Escape a CSV field value for comma-delimited format */
function escapeCsvField(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

/** Format number to 2 decimal places */
function fmt(n: number): string {
  return n.toFixed(2)
}

/** Build a single CSV data row */
function buildRow(row: ExportRow): string {
  const fields = [
    escapeCsvField(row.date),
    escapeCsvField(row.type),
    escapeCsvField(row.document_number),
    escapeCsvField(row.supplier_name),
    escapeCsvField(row.customer_name),
    fmt(row.amount_excl_vat),
    String(row.vat_rate),
    fmt(row.vat_amount),
    fmt(row.amount_incl_vat),
    escapeCsvField(row.currency),
    escapeCsvField(row.category),
    escapeCsvField(row.description),
  ]
  return fields.join(',')
}

export class GenericCsvAdapter implements ExportAdapter {
  format = 'csv_generic'

  generate(rows: ExportRow[], periodFrom: string, periodTo: string): ExportResult {
    const header =
      'date,type,document_number,supplier_name,customer_name,amount_excl_vat,vat_rate,vat_amount,amount_incl_vat,currency,category,description'

    const dataRows = rows.map(buildRow)
    const content = [header, ...dataRows].join('\r\n')

    const filename = `export_${periodFrom}_${periodTo}.csv`

    return {
      content,
      filename,
      mimeType: 'text/csv',
      rowCount: rows.length,
    }
  }
}
