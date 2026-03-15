// CII (Cross Industry Invoice) XML parser

import type { ParsedInvoice } from "./parse-ubl"

function extractText(xml: string, tag: string): string {
  const match = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`))
  return match ? match[1].trim() : ""
}

function extractBlock(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>[\\s\\S]*?</${tag}>`)
  const match = xml.match(regex)
  return match ? match[0] : ""
}

function parseNumber(value: string): number {
  const n = parseFloat(value)
  return isNaN(n) ? 0 : n
}

function parseTradeParty(partyXml: string) {
  const name = extractText(partyXml, "ram:Name")
  // Address
  const addressBlock = extractBlock(partyXml, "ram:PostalTradeAddress")
  const street = extractText(addressBlock, "ram:LineOne")
  const city = extractText(addressBlock, "ram:CityName")
  const zip = extractText(addressBlock, "ram:PostcodeCode")

  // Tax registration (IC DPH)
  const taxRegBlock = extractBlock(partyXml, "ram:SpecifiedTaxRegistration")
  const icDph = extractText(taxRegBlock, "ram:ID")

  // Legal organization (ICO)
  const legalBlock = extractBlock(partyXml, "ram:SpecifiedLegalOrganization")
  const ico = extractText(legalBlock, "ram:ID")

  return { name, ico, icDph, street, city, zip }
}

export function parseCiiInvoiceXml(xml: string): ParsedInvoice {
  // Document header
  const exchangedDocument = extractBlock(xml, "ram:ExchangedDocument")
  const invoiceNumber = extractText(exchangedDocument, "ram:ID")
  const issueDate = extractText(exchangedDocument, "udt:DateTimeString")

  // Trade agreement (supplier + customer)
  const tradeAgreement = extractBlock(xml, "ram:ApplicableHeaderTradeAgreement")
  const sellerBlock = extractBlock(tradeAgreement, "ram:SellerTradeParty")
  const buyerBlock = extractBlock(tradeAgreement, "ram:BuyerTradeParty")
  const supplier = parseTradeParty(sellerBlock)
  const customer = parseTradeParty(buyerBlock)

  // Trade settlement
  const tradeSettlement = extractBlock(xml, "ram:ApplicableHeaderTradeSettlement")
  const currency = extractText(tradeSettlement, "ram:InvoiceCurrencyCode") || "EUR"

  // Payment means
  const paymentMeans = extractBlock(tradeSettlement, "ram:SpecifiedTradeSettlementPaymentMeans")
  const accountBlock = extractBlock(paymentMeans, "ram:PayeePartyCreditorFinancialAccount")
  const iban = extractText(accountBlock, "ram:IBANID") || undefined

  // Payment terms / due date
  const paymentTerms = extractBlock(tradeSettlement, "ram:SpecifiedTradePaymentTerms")
  const dueDate = extractText(paymentTerms, "udt:DateTimeString")

  // Variable symbol (payment reference)
  const variableSymbol = extractText(tradeSettlement, "ram:PaymentReference") || undefined

  // Monetary summation
  const summation = extractBlock(tradeSettlement, "ram:SpecifiedTradeSettlementHeaderMonetarySummation")
  const totalAmount = parseNumber(extractText(summation, "ram:DuePayableAmount"))
  const vatAmount = parseNumber(extractText(summation, "ram:TaxTotalAmount"))

  // Notes
  const notes = extractText(exchangedDocument, "ram:Content") || undefined

  // Line items
  const items: ParsedInvoice["items"] = []
  const lineRegex = /<ram:IncludedSupplyChainTradeLineItem[\s>][\s\S]*?<\/ram:IncludedSupplyChainTradeLineItem>/g
  let lineMatch: RegExpExecArray | null
  while ((lineMatch = lineRegex.exec(xml)) !== null) {
    const line = lineMatch[0]
    const product = extractBlock(line, "ram:SpecifiedTradeProduct")
    const description = extractText(product, "ram:Name")

    const deliveryBlock = extractBlock(line, "ram:SpecifiedLineTradeDelivery")
    const quantity = parseNumber(extractText(deliveryBlock, "ram:BilledQuantity"))
    const unitMatch = line.match(/<ram:BilledQuantity[^>]*unitCode="([^"]*)"/)
    const unit = unitMatch ? unitMatch[1] : "C62"

    const agreementBlock = extractBlock(line, "ram:SpecifiedLineTradeAgreement")
    const priceBlock = extractBlock(agreementBlock, "ram:NetPriceProductTradePrice")
    const unitPrice = parseNumber(extractText(priceBlock, "ram:ChargeAmount"))

    const settlementBlock = extractBlock(line, "ram:SpecifiedLineTradeSettlement")
    const lineTaxBlock = extractBlock(settlementBlock, "ram:ApplicableTradeTax")
    const vatRate = parseNumber(extractText(lineTaxBlock, "ram:RateApplicablePercent"))

    const lineSummation = extractBlock(settlementBlock, "ram:SpecifiedTradeSettlementLineMonetarySummation")
    const lineTotal = parseNumber(extractText(lineSummation, "ram:LineTotalAmount"))
    const lineVatAmount = Math.round(lineTotal * (vatRate / 100) * 100) / 100
    const totalPrice = Math.round((lineTotal + lineVatAmount) * 100) / 100

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
