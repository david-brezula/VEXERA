import type { InvoiceNumberingFormat } from "@/features/invoices/types"

type InvoiceType = "issued" | "received" | "credit_note"

/**
 * Formats an invoice number from a numbering format config and sequence number.
 *
 * Examples with different configs:
 * - default:              "2025-001"
 * - prefix "FV":          "FV-2025-001"
 * - prefix "FV", sep "/": "FV/2025/001"
 * - short year:           "FV-25-001"
 * - no year:              "FV-001"
 * - type prefix "FV":     "FV-2025-001" (issued), "PF-2025-001" (received)
 */
export function formatInvoiceNumber(
  format: InvoiceNumberingFormat,
  invoiceType: InvoiceType,
  sequenceNumber: number
): string {
  const sep = format.separator

  // Resolve prefix
  let prefix = format.prefix
  if (format.includeType && format.typePrefixes) {
    prefix = format.typePrefixes[invoiceType] ?? prefix
  }

  // Year part
  const now = new Date()
  let yearPart = ""
  if (format.yearFormat === "full") {
    yearPart = String(now.getFullYear())
  } else if (format.yearFormat === "short") {
    yearPart = String(now.getFullYear()).slice(-2)
  }

  // Padded sequence
  const paddedNum = String(sequenceNumber).padStart(format.padding, "0")

  // Assemble parts, skipping empty segments
  const parts = [prefix, yearPart, paddedNum].filter(Boolean)
  return parts.join(sep)
}

/**
 * Builds a SQL LIKE pattern to match invoice numbers generated with the given format
 * for the current year. Used to find the latest sequence number.
 */
export function buildNumberLikePattern(
  format: InvoiceNumberingFormat,
  invoiceType: InvoiceType
): string {
  const sep = format.separator

  let prefix = format.prefix
  if (format.includeType && format.typePrefixes) {
    prefix = format.typePrefixes[invoiceType] ?? prefix
  }

  const now = new Date()
  let yearPart = ""
  if (format.yearFormat === "full") {
    yearPart = String(now.getFullYear())
  } else if (format.yearFormat === "short") {
    yearPart = String(now.getFullYear()).slice(-2)
  }

  const parts = [prefix, yearPart].filter(Boolean)
  // Match: {prefix}{sep}{year}{sep}% (the sequence part)
  return parts.length > 0 ? parts.join(sep) + sep + "%" : "%"
}

/**
 * Extracts the sequence number from an existing invoice number string.
 * Takes the last numeric segment after splitting by the separator.
 */
export function parseSequenceNumber(
  invoiceNumber: string,
  separator: string
): number {
  if (!separator) {
    // No separator — extract trailing digits
    const match = invoiceNumber.match(/(\d+)$/)
    return match ? parseInt(match[1], 10) : 0
  }
  const parts = invoiceNumber.split(separator)
  const lastPart = parts[parts.length - 1] ?? "0"
  return parseInt(lastPart, 10) || 0
}
