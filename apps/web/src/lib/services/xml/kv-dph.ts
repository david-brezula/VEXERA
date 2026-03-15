// KV DPH (Kontrolny Vykaz k DPH) XML generator
// Generates XML per Slovak Financial Administration specification

export interface KvDphInvoice {
  counterpartyIcDph: string | null
  invoiceNumber: string
  date: string // YYYY-MM-DD
  items: { taxBase: number; vatAmount: number; vatRate: number }[]
}

export interface KvDphInput {
  organization: { dic: string; ic_dph: string }
  year: number
  month: number
  filingType: "R" | "O" | "D"
  issuedInvoices: KvDphInvoice[]
  receivedInvoices: KvDphInvoice[]
  creditNotesIssued: KvDphInvoice[]
  creditNotesReceived: KvDphInvoice[]
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function formatDate(dateStr: string): string {
  // Convert YYYY-MM-DD to DD.MM.YYYY
  const [y, m, d] = dateStr.split("-")
  return `${d}.${m}.${y}`
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

interface AggregatedRate {
  vatRate: number
  taxBase: number
  vatAmount: number
}

function aggregateByRate(invoices: KvDphInvoice[]): AggregatedRate[] {
  const map = new Map<number, { taxBase: number; vatAmount: number }>()
  for (const inv of invoices) {
    for (const item of inv.items) {
      const existing = map.get(item.vatRate)
      if (existing) {
        existing.taxBase += item.taxBase
        existing.vatAmount += item.vatAmount
      } else {
        map.set(item.vatRate, {
          taxBase: item.taxBase,
          vatAmount: item.vatAmount,
        })
      }
    }
  }
  return Array.from(map.entries()).map(([vatRate, { taxBase, vatAmount }]) => ({
    vatRate,
    taxBase: round2(taxBase),
    vatAmount: round2(vatAmount),
  }))
}

function renderDetailRows(invoices: KvDphInvoice[]): string {
  const rows: string[] = []
  for (const inv of invoices) {
    for (const item of inv.items) {
      rows.push(
        `      <z>
        <icDphOdb>${escapeXml(inv.counterpartyIcDph ?? "")}</icDphOdb>
        <cisloFaktury>${escapeXml(inv.invoiceNumber)}</cisloFaktury>
        <datumDodania>${formatDate(inv.date)}</datumDodania>
        <zakladDane>${round2(item.taxBase).toFixed(2)}</zakladDane>
        <662>${round2(item.vatAmount).toFixed(2)}</662>
        <sadzbaDane>${item.vatRate}</sadzbaDane>
      </z>`
      )
    }
  }
  return rows.join("\n")
}

function renderAggregatedRows(rates: AggregatedRate[]): string {
  return rates
    .map(
      (r) =>
        `      <z>
        <zakladDane>${r.taxBase.toFixed(2)}</zakladDane>
        <662>${r.vatAmount.toFixed(2)}</662>
        <sadzbaDane>${r.vatRate}</sadzbaDane>
      </z>`
    )
    .join("\n")
}

function sumTaxBase(invoices: KvDphInvoice[]): number {
  let total = 0
  for (const inv of invoices) {
    for (const item of inv.items) {
      total += item.taxBase
    }
  }
  return round2(total)
}

function sumVat(invoices: KvDphInvoice[]): number {
  let total = 0
  for (const inv of invoices) {
    for (const item of inv.items) {
      total += item.vatAmount
    }
  }
  return round2(total)
}

export function generateKvDphXml(input: KvDphInput): string {
  const { organization, year, month, filingType } = input

  // Categorize issued invoices: with IC DPH -> A1, without -> A2
  const a1Invoices = input.issuedInvoices.filter(
    (inv) => inv.counterpartyIcDph
  )
  const a2Invoices = input.issuedInvoices.filter(
    (inv) => !inv.counterpartyIcDph
  )

  // Categorize received invoices: with IC DPH -> B1, without -> B2
  const b1Invoices = input.receivedInvoices.filter(
    (inv) => inv.counterpartyIcDph
  )
  const b2Invoices = input.receivedInvoices.filter(
    (inv) => !inv.counterpartyIcDph
  )

  const a1Rows = renderDetailRows(a1Invoices)
  const a2Rates = aggregateByRate(a2Invoices)
  const a2Rows = renderAggregatedRows(a2Rates)
  const b1Rows = renderDetailRows(b1Invoices)
  const b2Rates = aggregateByRate(b2Invoices)
  const b2Rows = renderAggregatedRows(b2Rates)
  const c1Rows = renderDetailRows(input.creditNotesIssued)
  const c2Rows = renderDetailRows(input.creditNotesReceived)

  // D section totals
  const totalA1Base = sumTaxBase(a1Invoices)
  const totalA1Vat = sumVat(a1Invoices)
  const totalA2Base = a2Rates.reduce((s, r) => s + r.taxBase, 0)
  const totalA2Vat = a2Rates.reduce((s, r) => s + r.vatAmount, 0)
  const totalB1Base = sumTaxBase(b1Invoices)
  const totalB1Vat = sumVat(b1Invoices)
  const totalB2Base = b2Rates.reduce((s, r) => s + r.taxBase, 0)
  const totalB2Vat = b2Rates.reduce((s, r) => s + r.vatAmount, 0)
  const totalC1Base = sumTaxBase(input.creditNotesIssued)
  const totalC1Vat = sumVat(input.creditNotesIssued)
  const totalC2Base = sumTaxBase(input.creditNotesReceived)
  const totalC2Vat = sumVat(input.creditNotesReceived)

  const obdobie = String(month).padStart(2, "0")

  return `<?xml version="1.0" encoding="UTF-8"?>
<KVDPHv2 xmlns="http://www.financnasprava.sk/KVDPHv2">
  <hlavicka>
    <dic>${escapeXml(organization.dic)}</dic>
    <icDph>${escapeXml(organization.ic_dph)}</icDph>
    <rok>${year}</rok>
    <obdobie>${obdobie}</obdobie>
    <druhPriznania>${filingType}</druhPriznania>
  </hlavicka>
  <telo>
    <A1>
${a1Rows}
    </A1>
    <A2>
${a2Rows}
    </A2>
    <B1>
${b1Rows}
    </B1>
    <B2>
${b2Rows}
    </B2>
    <C1>
${c1Rows}
    </C1>
    <C2>
${c2Rows}
    </C2>
    <D>
      <zakladDaneA1>${round2(totalA1Base).toFixed(2)}</zakladDaneA1>
      <662A1>${round2(totalA1Vat).toFixed(2)}</662A1>
      <zakladDaneA2>${round2(totalA2Base).toFixed(2)}</zakladDaneA2>
      <662A2>${round2(totalA2Vat).toFixed(2)}</662A2>
      <zakladDaneB1>${round2(totalB1Base).toFixed(2)}</zakladDaneB1>
      <662B1>${round2(totalB1Vat).toFixed(2)}</662B1>
      <zakladDaneB2>${round2(totalB2Base).toFixed(2)}</zakladDaneB2>
      <662B2>${round2(totalB2Vat).toFixed(2)}</662B2>
      <zakladDaneC1>${round2(totalC1Base).toFixed(2)}</zakladDaneC1>
      <662C1>${round2(totalC1Vat).toFixed(2)}</662C1>
      <zakladDaneC2>${round2(totalC2Base).toFixed(2)}</zakladDaneC2>
      <662C2>${round2(totalC2Vat).toFixed(2)}</662C2>
    </D>
  </telo>
</KVDPHv2>`
}
