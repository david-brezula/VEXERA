// Peppol BIS 3.0 / UBL 2.1 Invoice XML generator

export interface UblInvoiceInput {
  invoice: {
    invoice_number: string
    issue_date: string
    due_date: string
    notes?: string
    total_amount: number
    vat_amount: number
    supplier_name: string
    supplier_ico?: string
    supplier_ic_dph?: string
    supplier_street?: string
    supplier_city?: string
    supplier_zip?: string
    customer_name: string
    customer_ico?: string
    customer_ic_dph?: string
    customer_street?: string
    customer_city?: string
    customer_zip?: string
    bank_iban?: string
    variable_symbol?: string
    items: {
      description: string
      quantity: number
      unit: string
      unit_price: number
      vat_rate: number
      vat_amount: number
      total_price: number
    }[]
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

function fmt(n: number): string {
  return round2(n).toFixed(2)
}

function vatCategoryCode(rate: number): string {
  return rate === 0 ? "Z" : "S"
}

interface TaxGroup {
  vatRate: number
  taxableAmount: number
  taxAmount: number
}

function groupByVatRate(
  items: UblInvoiceInput["invoice"]["items"]
): TaxGroup[] {
  const map = new Map<number, { taxableAmount: number; taxAmount: number }>()
  for (const item of items) {
    const base = round2(item.quantity * item.unit_price)
    const existing = map.get(item.vat_rate)
    if (existing) {
      existing.taxableAmount += base
      existing.taxAmount += item.vat_amount
    } else {
      map.set(item.vat_rate, {
        taxableAmount: base,
        taxAmount: item.vat_amount,
      })
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([vatRate, { taxableAmount, taxAmount }]) => ({
      vatRate,
      taxableAmount: round2(taxableAmount),
      taxAmount: round2(taxAmount),
    }))
}

function renderParty(
  name: string,
  ico?: string,
  icDph?: string,
  street?: string,
  city?: string,
  zip?: string
): string {
  const lines: string[] = []
  lines.push(`      <cac:Party>`)
  if (icDph) {
    lines.push(`        <cbc:EndpointID schemeID="SK:ORSR">${escapeXml(icDph)}</cbc:EndpointID>`)
  }
  lines.push(`        <cac:PartyName>`)
  lines.push(`          <cbc:Name>${escapeXml(name)}</cbc:Name>`)
  lines.push(`        </cac:PartyName>`)
  lines.push(`        <cac:PostalAddress>`)
  if (street) lines.push(`          <cbc:StreetName>${escapeXml(street)}</cbc:StreetName>`)
  if (city) lines.push(`          <cbc:CityName>${escapeXml(city)}</cbc:CityName>`)
  if (zip) lines.push(`          <cbc:PostalZone>${escapeXml(zip)}</cbc:PostalZone>`)
  lines.push(`          <cac:Country>`)
  lines.push(`            <cbc:IdentificationCode>SK</cbc:IdentificationCode>`)
  lines.push(`          </cac:Country>`)
  lines.push(`        </cac:PostalAddress>`)
  if (icDph) {
    lines.push(`        <cac:PartyTaxScheme>`)
    lines.push(`          <cbc:CompanyID>${escapeXml(icDph)}</cbc:CompanyID>`)
    lines.push(`          <cac:TaxScheme>`)
    lines.push(`            <cbc:ID>VAT</cbc:ID>`)
    lines.push(`          </cac:TaxScheme>`)
    lines.push(`        </cac:PartyTaxScheme>`)
  }
  lines.push(`        <cac:PartyLegalEntity>`)
  lines.push(`          <cbc:RegistrationName>${escapeXml(name)}</cbc:RegistrationName>`)
  if (ico) lines.push(`          <cbc:CompanyID>${escapeXml(ico)}</cbc:CompanyID>`)
  lines.push(`        </cac:PartyLegalEntity>`)
  lines.push(`      </cac:Party>`)
  return lines.join("\n")
}

function renderInvoiceLine(
  item: UblInvoiceInput["invoice"]["items"][number],
  index: number
): string {
  const lineExtension = round2(item.quantity * item.unit_price)
  const catCode = vatCategoryCode(item.vat_rate)
  return `  <cac:InvoiceLine>
    <cbc:ID>${index + 1}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="${escapeXml(item.unit)}">${item.quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">${fmt(lineExtension)}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>${escapeXml(item.description)}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>${catCode}</cbc:ID>
        <cbc:Percent>${item.vat_rate}</cbc:Percent>
        <cac:TaxScheme>
          <cbc:ID>VAT</cbc:ID>
        </cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">${fmt(item.unit_price)}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>`
}

export function generateUblInvoiceXml(input: UblInvoiceInput): string {
  const inv = input.invoice
  const taxGroups = groupByVatRate(inv.items)
  const taxExclAmount = round2(inv.total_amount - inv.vat_amount)

  const taxSubtotals = taxGroups
    .map(
      (g) => `      <cac:TaxSubtotal>
        <cbc:TaxableAmount currencyID="EUR">${fmt(g.taxableAmount)}</cbc:TaxableAmount>
        <cbc:TaxAmount currencyID="EUR">${fmt(g.taxAmount)}</cbc:TaxAmount>
        <cac:TaxCategory>
          <cbc:ID>${vatCategoryCode(g.vatRate)}</cbc:ID>
          <cbc:Percent>${g.vatRate}</cbc:Percent>
          <cac:TaxScheme>
            <cbc:ID>VAT</cbc:ID>
          </cac:TaxScheme>
        </cac:TaxCategory>
      </cac:TaxSubtotal>`
    )
    .join("\n")

  const invoiceLines = inv.items
    .map((item, i) => renderInvoiceLine(item, i))
    .join("\n")

  const noteElement = inv.notes
    ? `  <cbc:Note>${escapeXml(inv.notes)}</cbc:Note>\n`
    : ""

  const paymentMeans = inv.bank_iban
    ? `  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
${inv.variable_symbol ? `    <cbc:PaymentID>${escapeXml(inv.variable_symbol)}</cbc:PaymentID>\n` : ""}    <cac:PayeeFinancialAccount>
      <cbc:ID>${escapeXml(inv.bank_iban)}</cbc:ID>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>`
    : `  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>1</cbc:PaymentMeansCode>
  </cac:PaymentMeans>`

  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>${escapeXml(inv.invoice_number)}</cbc:ID>
  <cbc:IssueDate>${escapeXml(inv.issue_date)}</cbc:IssueDate>
  <cbc:DueDate>${escapeXml(inv.due_date)}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
${noteElement}  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
${renderParty(
  inv.supplier_name,
  inv.supplier_ico,
  inv.supplier_ic_dph,
  inv.supplier_street,
  inv.supplier_city,
  inv.supplier_zip
)}
  </cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>
${renderParty(
  inv.customer_name,
  inv.customer_ico,
  inv.customer_ic_dph,
  inv.customer_street,
  inv.customer_city,
  inv.customer_zip
)}
  </cac:AccountingCustomerParty>
${paymentMeans}
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">${fmt(inv.vat_amount)}</cbc:TaxAmount>
${taxSubtotals}
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">${fmt(taxExclAmount)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">${fmt(taxExclAmount)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">${fmt(inv.total_amount)}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">${fmt(inv.total_amount)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
${invoiceLines}
</Invoice>`
}
