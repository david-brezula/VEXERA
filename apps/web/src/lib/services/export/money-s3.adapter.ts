/**
 * Money S3 CSV Adapter
 *
 * Generates semicolon-delimited CSV for Money S3 (Slovak accounting software).
 *
 * Format spec (SK):
 *   Typ;Číslo dokladu;Dátum;Dodávateľ/Odberateľ;Suma bez DPH;Sadzba DPH;DPH;Suma s DPH;Mena;Účet
 *
 * Type codes:
 *   F = Faktúra vydaná (issued invoice)
 *   P = Faktúra prijatá (received invoice)
 *   B = Pokladničný doklad (receipt)
 *   O = Ostatné (other)
 *
 * Dates use DD.MM.YYYY format (Slovak standard).
 * Numbers use period (.) as decimal separator.
 * VAT rate is stored as integer (20 not 0.20).
 */

import type { ExportAdapter, ExportRow, ExportResult } from './export.adapter'

/** Map document type to Money S3 type code */
function toMoneyType(type: ExportRow['type']): string {
  switch (type) {
    case 'invoice_issued': return 'F'
    case 'invoice_received': return 'P'
    case 'receipt': return 'B'
    case 'other': return 'O'
    default: return 'O'
  }
}

/**
 * Convert ISO date YYYY-MM-DD to Slovak format DD.MM.YYYY.
 * Falls back to original value if parsing fails.
 */
function formatDate(isoDate: string): string {
  const parts = isoDate.split('-')
  if (parts.length === 3) {
    const [year, month, day] = parts
    return `${day}.${month}.${year}`
  }
  return isoDate
}

/** Escape a CSV field value: wrap in quotes if it contains semicolons or quotes */
function escapeCsvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  // Money S3 uses semicolon delimiter — wrap in double quotes if needed
  if (str.includes(';') || str.includes('"') || str.includes('\n')) {
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
    toMoneyType(row.type),
    escapeCsvField(row.document_number),
    formatDate(row.date),
    escapeCsvField(row.type === 'invoice_received' ? row.supplier_name : row.customer_name),
    fmt(row.amount_excl_vat),
    String(row.vat_rate),
    fmt(row.vat_amount),
    fmt(row.amount_incl_vat),
    escapeCsvField(row.currency),
    escapeCsvField(row.account_number),
  ]
  return fields.join(';')
}

export class MoneyS3Adapter implements ExportAdapter {
  format = 'money_s3'

  generate(rows: ExportRow[], periodFrom: string, periodTo: string): ExportResult {
    const header =
      'Typ;Číslo dokladu;Dátum;Dodávateľ/Odberateľ;Suma bez DPH;Sadzba DPH;DPH;Suma s DPH;Mena;Účet'

    const dataRows = rows.map(buildRow)
    const content = [header, ...dataRows].join('\r\n')

    // Money S3 expects ANSI/Windows-1250 in production, but UTF-8 is acceptable for modern versions.
    const filename = `money_s3_${periodFrom}_${periodTo}.csv`

    return {
      content,
      filename,
      mimeType: 'text/csv',
      rowCount: rows.length,
    }
  }
}
