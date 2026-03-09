/**
 * Pohoda XML Adapter
 *
 * Generates Pohoda XML for Slovak accounting software (STORMWARE Pohoda).
 * Format spec: http://www.stormware.sk/schema/version_2/
 *
 * Produces a dataPack containing one dataPackItem per row.
 * Invoice types:
 *   invoice_issued   → issuedInvoice
 *   invoice_received → receivedInvoice
 *   receipt          → issuedInvoice (simplified receipt)
 *   other            → issuedInvoice (fallback)
 */

import type { ExportAdapter, ExportRow, ExportResult } from './export.adapter'

/** Map our document types to Pohoda invoice type codes */
function toPohodaInvoiceType(type: ExportRow['type']): string {
  switch (type) {
    case 'invoice_issued': return 'issuedInvoice'
    case 'invoice_received': return 'receivedInvoice'
    case 'receipt': return 'issuedInvoice'
    case 'other': return 'issuedInvoice'
    default: return 'issuedInvoice'
  }
}

/** Escape XML special characters */
function escapeXml(value: string | null | undefined): string {
  if (!value) return ''
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/** Format a number to 2 decimal places */
function fmt(n: number): string {
  return n.toFixed(2)
}

/** Build a single <dat:dataPackItem> element for one row */
function buildDataPackItem(row: ExportRow, index: number): string {
  const invoiceType = toPohodaInvoiceType(row.type)
  const partnerTag =
    row.type === 'invoice_received' ? 'supplierIdentity' : 'partnerIdentity'
  const companyName =
    row.type === 'invoice_received'
      ? escapeXml(row.supplier_name)
      : escapeXml(row.customer_name)
  const docNumber = escapeXml(row.document_number)

  return `  <dat:dataPackItem id="${index + 1}" version="2.0">
    <inv:invoiceType xmlns:inv="http://www.stormware.sk/schema/version_2/invoice.xsd">
      <inv:invoiceHeader>
        <inv:invoiceType>${invoiceType}</inv:invoiceType>
        <inv:number>
          <typ:numberRequested xmlns:typ="http://www.stormware.sk/schema/version_2/type.xsd">${docNumber}</typ:numberRequested>
        </inv:number>
        <inv:date>${escapeXml(row.date)}</inv:date>
        <inv:accounting>
          <typ:ids xmlns:typ="http://www.stormware.sk/schema/version_2/type.xsd">${escapeXml(row.account_number)}</typ:ids>
        </inv:accounting>
        <inv:text>${escapeXml(row.description)}</inv:text>
        <inv:${partnerTag}>
          <adr:address xmlns:adr="http://www.stormware.sk/schema/version_2/address.xsd">
            <adr:company>${companyName}</adr:company>
          </adr:address>
        </inv:${partnerTag}>
      </inv:invoiceHeader>
      <inv:invoiceSummary>
        <inv:roundingDocument>math2one</inv:roundingDocument>
        <inv:homeCurrency>
          <typ:priceNone xmlns:typ="http://www.stormware.sk/schema/version_2/type.xsd">0</typ:priceNone>
          <typ:priceLow xmlns:typ="http://www.stormware.sk/schema/version_2/type.xsd">${fmt(row.amount_excl_vat)}</typ:priceLow>
          <typ:priceLowVAT xmlns:typ="http://www.stormware.sk/schema/version_2/type.xsd">${fmt(row.vat_amount)}</typ:priceLowVAT>
          <typ:priceLowSum xmlns:typ="http://www.stormware.sk/schema/version_2/type.xsd">${fmt(row.amount_incl_vat)}</typ:priceLowSum>
          <typ:priceHigh xmlns:typ="http://www.stormware.sk/schema/version_2/type.xsd">0</typ:priceHigh>
          <typ:priceHighVAT xmlns:typ="http://www.stormware.sk/schema/version_2/type.xsd">0</typ:priceHighVAT>
          <typ:priceHighSum xmlns:typ="http://www.stormware.sk/schema/version_2/type.xsd">0</typ:priceHighSum>
        </inv:homeCurrency>
        <inv:foreignCurrency>
          <typ:currency xmlns:typ="http://www.stormware.sk/schema/version_2/type.xsd">
            <typ:ids>${escapeXml(row.currency)}</typ:ids>
          </typ:currency>
        </inv:foreignCurrency>
      </inv:invoiceSummary>
    </inv:invoiceType>
  </dat:dataPackItem>`
}

export class PohodaAdapter implements ExportAdapter {
  format = 'pohoda'

  generate(rows: ExportRow[], periodFrom: string, periodTo: string): ExportResult {
    const items = rows.map((row, i) => buildDataPackItem(row, i)).join('\n')

    const content = `<?xml version="1.0" encoding="UTF-8"?>
<dat:dataPack
  xmlns:dat="http://www.stormware.sk/schema/version_2/data.xsd"
  xmlns:typ="http://www.stormware.sk/schema/version_2/type.xsd"
  id="Vexera"
  ico="00000000"
  application="Vexera"
  version="2.0"
  note="Export ${periodFrom} — ${periodTo}">
${items}
</dat:dataPack>`

    const filename = `pohoda_${periodFrom}_${periodTo}.xml`

    return {
      content,
      filename,
      mimeType: 'application/xml',
      rowCount: rows.length,
    }
  }
}
