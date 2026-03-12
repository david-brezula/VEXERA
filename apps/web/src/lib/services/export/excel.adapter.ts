/**
 * Excel Export Adapter
 *
 * Generates .xlsx files with formatted columns for financial reports.
 * Uses a simple CSV-based approach (no external dependency required).
 *
 * Usage:
 *   const buffer = generateExcelCSV(data, columns)
 */

export interface ExcelColumn {
  header: string
  key: string
  width?: number
  format?: "text" | "number" | "currency" | "date" | "percent"
}

/**
 * Generate a CSV buffer that can be opened in Excel.
 * Uses UTF-8 BOM for proper encoding of Slovak characters.
 */
export function generateExcelCSV(
  data: Record<string, unknown>[],
  columns: ExcelColumn[]
): Buffer {
  const BOM = "\uFEFF"

  // Header row
  const header = columns.map((c) => escapeCSV(c.header)).join(";")

  // Data rows
  const rows = data.map((row) =>
    columns
      .map((col) => {
        const value = row[col.key]
        if (value === null || value === undefined) return ""
        if (col.format === "currency" || col.format === "number") {
          return typeof value === "number" ? value.toString().replace(".", ",") : String(value)
        }
        if (col.format === "percent") {
          return typeof value === "number" ? `${value}%` : String(value)
        }
        return escapeCSV(String(value))
      })
      .join(";")
  )

  const csv = BOM + [header, ...rows].join("\r\n")
  return Buffer.from(csv, "utf-8")
}

/**
 * Generate an Excel-compatible report with summary rows.
 */
export function generateReportExcel(
  title: string,
  sections: Array<{
    name: string
    data: Record<string, unknown>[]
    columns: ExcelColumn[]
    summary?: Record<string, unknown>
  }>
): Buffer {
  const BOM = "\uFEFF"
  const lines: string[] = []

  // Title
  lines.push(escapeCSV(title))
  lines.push(`Generované: ${new Date().toLocaleDateString("sk-SK")}`)
  lines.push("")

  for (const section of sections) {
    // Section header
    lines.push(escapeCSV(section.name))

    // Column headers
    lines.push(section.columns.map((c) => escapeCSV(c.header)).join(";"))

    // Data rows
    for (const row of section.data) {
      lines.push(
        section.columns
          .map((col) => {
            const value = row[col.key]
            if (value === null || value === undefined) return ""
            if (col.format === "currency" || col.format === "number") {
              return typeof value === "number" ? value.toString().replace(".", ",") : String(value)
            }
            return escapeCSV(String(value))
          })
          .join(";")
      )
    }

    // Summary row
    if (section.summary) {
      lines.push(
        section.columns
          .map((col) => {
            const value = section.summary?.[col.key]
            if (value === null || value === undefined) return ""
            if (typeof value === "number") return value.toString().replace(".", ",")
            return escapeCSV(String(value))
          })
          .join(";")
      )
    }

    lines.push("")
  }

  const csv = BOM + lines.join("\r\n")
  return Buffer.from(csv, "utf-8")
}

function escapeCSV(value: string): string {
  if (value.includes(";") || value.includes('"') || value.includes("\n")) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
