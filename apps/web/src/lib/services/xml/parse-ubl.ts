// UBL 2.1 Invoice XML parser

export interface ParsedInvoice {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  notes?: string
  currency: string
  supplierName: string
  supplierIco?: string
  supplierIcDph?: string
  supplierStreet?: string
  supplierCity?: string
  supplierZip?: string
  customerName: string
  customerIco?: string
  customerIcDph?: string
  customerStreet?: string
  customerCity?: string
  customerZip?: string
  iban?: string
  variableSymbol?: string
  totalAmount: number
  vatAmount: number
  items: {
    description: string
    quantity: number
    unit: string
    unitPrice: number
    vatRate: number
    vatAmount: number
    totalPrice: number
  }[]
}

function extractText(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))
  return match ? match[1].trim() : ""
}

function extractBlock(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`)
  const match = xml.match(regex)
  return match ? match[0] : ""
}

function parseParty(partyXml: string) {
  const party = extractBlock(partyXml, "cac:Party")
  return {
    name: extractText(party, "cbc:Name") || extractText(party, "cbc:RegistrationName"),
    ico: extractText(extractBlock(party, "cac:PartyLegalEntity"), "cbc:CompanyID"),
    icDph: extractText(extractBlock(party, "cac:PartyTaxScheme"), "cbc:CompanyID"),
    street: extractText(party, "cbc:StreetName"),
    city: extractText(party, "cbc:CityName"),
    zip: extractText(party, "cbc:PostalZone"),
  }
}

function parseNumber(value: string): number {
  const n = parseFloat(value)
  return isNaN(n) ? 0 : n
}

export function parseUblInvoiceXml(xml: string): ParsedInvoice {
  // Top-level fields
  const invoiceNumber = extractText(xml, "cbc:ID")
  const issueDate = extractText(xml, "cbc:IssueDate")
  const dueDate = extractText(xml, "cbc:DueDate")
  const notes = extractText(xml, "cbc:Note") || undefined
  const currency = extractText(xml, "cbc:DocumentCurrencyCode") || "EUR"

  // Supplier
  const supplierBlock = extractBlock(xml, "cac:AccountingSupplierParty")
  const supplier = parseParty(supplierBlock)

  // Customer
  const customerBlock = extractBlock(xml, "cac:AccountingCustomerParty")
  const customer = parseParty(customerBlock)

  // Payment means
  const paymentMeansBlock = extractBlock(xml, "cac:PaymentMeans")
  const iban = extractText(extractBlock(paymentMeansBlock, "cac:PayeeFinancialAccount"), "cbc:ID") || undefined
  const variableSymbol = extractText(paymentMeansBlock, "cbc:PaymentID") || undefined

  // Totals
  const legalMonetaryTotal = extractBlock(xml, "cac:LegalMonetaryTotal")
  const totalAmount = parseNumber(extractText(legalMonetaryTotal, "cbc:PayableAmount"))
  const vatAmount = parseNumber(extractText(extractBlock(xml, "cac:TaxTotal"), "cbc:TaxAmount"))

  // Items – split by InvoiceLine
  const items: ParsedInvoice["items"] = []
  const lineRegex = /<cac:InvoiceLine[\s>][\s\S]*?<\/cac:InvoiceLine>/g
  let lineMatch: RegExpExecArray | null
  while ((lineMatch = lineRegex.exec(xml)) !== null) {
    const line = lineMatch[0]
    const description = extractText(extractBlock(line, "cac:Item"), "cbc:Name")
    const quantityMatch = line.match(/<cbc:InvoicedQuantity[^>]*>([^<]*)<\/cbc:InvoicedQuantity>/)
    const quantity = quantityMatch ? parseNumber(quantityMatch[1]) : 1
    const unitMatch = line.match(/unitCode="([^"]*)"/)
    const unit = unitMatch ? unitMatch[1] : "C62"
    const unitPrice = parseNumber(extractText(extractBlock(line, "cac:Price"), "cbc:PriceAmount"))
    const vatRate = parseNumber(extractText(extractBlock(line, "cac:ClassifiedTaxCategory"), "cbc:Percent"))
    const lineExtension = parseNumber(extractText(line, "cbc:LineExtensionAmount"))
    const lineVatAmount = Math.round(lineExtension * (vatRate / 100) * 100) / 100
    const totalPrice = Math.round((lineExtension + lineVatAmount) * 100) / 100

    items.push({
      description,
      quantity,
      unit,
      unitPrice,
      vatRate,
      vatAmount: lineVatAmount,
      totalPrice,
    })
  }

  return {
    invoiceNumber,
    issueDate,
    dueDate,
    notes,
    currency,
    supplierName: supplier.name,
    supplierIco: supplier.ico || undefined,
    supplierIcDph: supplier.icDph || undefined,
    supplierStreet: supplier.street || undefined,
    supplierCity: supplier.city || undefined,
    supplierZip: supplier.zip || undefined,
    customerName: customer.name,
    customerIco: customer.ico || undefined,
    customerIcDph: customer.icDph || undefined,
    customerStreet: customer.street || undefined,
    customerCity: customer.city || undefined,
    customerZip: customer.zip || undefined,
    iban,
    variableSymbol,
    totalAmount,
    vatAmount,
    items,
  }
}
