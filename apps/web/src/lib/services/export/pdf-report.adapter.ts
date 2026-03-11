/**
 * PDF Report Adapter
 *
 * Generates structured HTML that can be rendered as PDF via browser print
 * or a server-side PDF library. No external dependency required for the HTML approach.
 *
 * Usage:
 *   const html = generatePDFHtml(title, sections)
 *   // Render via window.print() or a PDF service
 */

export interface PDFSection {
  title: string
  type: "table" | "summary" | "text"
  content: PDFTableContent | PDFSummaryContent | string
}

export interface PDFTableContent {
  headers: string[]
  rows: string[][]
  footer?: string[]
}

export interface PDFSummaryContent {
  items: Array<{ label: string; value: string; highlight?: boolean }>
}

/**
 * Generate print-ready HTML for a financial report.
 */
export function generatePDFHtml(
  title: string,
  period: string,
  currency: string,
  sections: PDFSection[]
): string {
  const sectionHtml = sections.map(renderSection).join("")

  return `<!DOCTYPE html>
<html lang="sk">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
  @page { margin: 20mm; size: A4; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; font-size: 11px; color: #1a1a1a; line-height: 1.5; }
  .header { border-bottom: 2px solid #2563eb; padding-bottom: 12px; margin-bottom: 24px; }
  .header h1 { font-size: 20px; margin: 0 0 4px; color: #1e293b; }
  .header .meta { color: #64748b; font-size: 12px; }
  .section { margin-bottom: 24px; }
  .section h2 { font-size: 14px; color: #1e293b; margin: 0 0 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f8fafc; text-align: left; padding: 6px 8px; font-weight: 600; border-bottom: 1px solid #e2e8f0; font-size: 10px; text-transform: uppercase; color: #64748b; }
  td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
  tr:last-child td { border-bottom: none; }
  .footer-row { font-weight: 700; background: #f8fafc; border-top: 2px solid #e2e8f0; }
  .text-right { text-align: right; }
  .summary-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
  .summary-item { padding: 12px; border: 1px solid #e2e8f0; border-radius: 6px; }
  .summary-item.highlight { background: #eff6ff; border-color: #2563eb; }
  .summary-label { font-size: 10px; color: #64748b; text-transform: uppercase; }
  .summary-value { font-size: 18px; font-weight: 700; color: #1e293b; }
  .page-footer { margin-top: 32px; padding-top: 12px; border-top: 1px solid #e2e8f0; color: #94a3b8; font-size: 9px; display: flex; justify-content: space-between; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
</style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(title)}</h1>
    <div class="meta">
      Obdobie: ${escapeHtml(period)} | Mena: ${escapeHtml(currency)} | Vygenerované: ${new Date().toLocaleDateString("sk-SK")}
    </div>
  </div>
  ${sectionHtml}
  <div class="page-footer">
    <span>Vexera - Účtovná automatizácia</span>
    <span>Strana 1</span>
  </div>
</body>
</html>`
}

function renderSection(section: PDFSection): string {
  let inner = ""

  if (section.type === "table") {
    const content = section.content as PDFTableContent
    const headerHtml = content.headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("")
    const rowsHtml = content.rows
      .map((row) => `<tr>${row.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`)
      .join("")
    const footerHtml = content.footer
      ? `<tr class="footer-row">${content.footer.map((c) => `<td>${escapeHtml(c)}</td>`).join("")}</tr>`
      : ""

    inner = `<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}${footerHtml}</tbody></table>`
  } else if (section.type === "summary") {
    const content = section.content as PDFSummaryContent
    const items = content.items
      .map(
        (item) =>
          `<div class="summary-item${item.highlight ? " highlight" : ""}">
            <div class="summary-label">${escapeHtml(item.label)}</div>
            <div class="summary-value">${escapeHtml(item.value)}</div>
          </div>`
      )
      .join("")
    inner = `<div class="summary-grid">${items}</div>`
  } else {
    inner = `<p>${escapeHtml(section.content as string)}</p>`
  }

  return `<div class="section"><h2>${escapeHtml(section.title)}</h2>${inner}</div>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}
