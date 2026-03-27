// DP DPH (Danove Priznanie k DPH) XML generator
// Generates the VAT tax return XML per Slovak Financial Administration specification

export interface DpDphInput {
  organization: {
    dic: string
    ic_dph: string
    name: string
    address_street: string
    address_city: string
    address_zip: string
  }
  year: number
  month: number
  filingType: "R" | "O" | "D"
  vatReturn: {
    vat_output_23: number
    vat_output_19: number
    vat_output_5: number
    vat_input_23: number
    vat_input_19: number
    vat_input_5: number
    total_output_vat: number
    total_input_vat: number
    vat_liability: number
    taxable_base_output: number
    taxable_base_input: number
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

/**
 * Compute approximate tax base from VAT amount and rate.
 * base = vat / rate * 100
 */
function baseFromVat(vat: number, ratePercent: number): number {
  if (ratePercent === 0) return 0
  return round2((vat / ratePercent) * 100)
}

export function generateDpDphXml(input: DpDphInput): string {
  const { organization, year, month, filingType, vatReturn } = input

  const obdobie = String(month).padStart(2, "0")
  const filingDate = new Date().toISOString().slice(0, 10) // YYYY-MM-DD

  // Compute per-rate tax bases from VAT amounts
  const base23Output = baseFromVat(vatReturn.vat_output_23, 23)
  const base19Output = baseFromVat(vatReturn.vat_output_19, 19)
  const base5Output = baseFromVat(vatReturn.vat_output_5, 5)

  const base23Input = baseFromVat(vatReturn.vat_input_23, 23)
  const base19Input = baseFromVat(vatReturn.vat_input_19, 19)
  const base5Input = baseFromVat(vatReturn.vat_input_5, 5)

  const totalOutputVat = vatReturn.total_output_vat
  const totalInputVat = vatReturn.total_input_vat
  const liability = vatReturn.vat_liability

  const toPay = liability > 0 ? liability : 0
  const overpayment = liability < 0 ? Math.abs(liability) : 0

  return `<?xml version="1.0" encoding="UTF-8"?>
<DPDPHv2 xmlns="http://www.financnasprava.sk/DPDPHv2">
  <hlavicka>
    <dic>${escapeXml(organization.dic)}</dic>
    <icDph>${escapeXml(organization.ic_dph)}</icDph>
    <rok>${year}</rok>
    <obdobie>${obdobie}</obdobie>
    <druhPriznania>${filingType}</druhPriznania>
    <datumPodania>${filingDate}</datumPodania>
  </hlavicka>
  <dpiDPH>
    <nazov>${escapeXml(organization.name)}</nazov>
    <ulica>${escapeXml(organization.address_street)}</ulica>
    <obec>${escapeXml(organization.address_city)}</obec>
    <psc>${escapeXml(organization.address_zip)}</psc>
  </dpiDPH>
  <telo>
    <r01>${fmt(base23Output)}</r01><r01d>${fmt(vatReturn.vat_output_23)}</r01d>
    <r02>${fmt(base19Output)}</r02><r02d>${fmt(vatReturn.vat_output_19)}</r02d>
    <r03>${fmt(base5Output)}</r03><r03d>${fmt(vatReturn.vat_output_5)}</r03d>
    <r04>0.00</r04><r04d>0.00</r04d>
    <r05>0.00</r05><r05d>0.00</r05d>
    <r06>0.00</r06><r06d>0.00</r06d>
    <r07>0.00</r07><r08>0.00</r08><r09>0.00</r09><r10>0.00</r10>
    <r11>0.00</r11><r12>0.00</r12><r13>0.00</r13>
    <r14>${fmt(base23Input)}</r14><r14d>${fmt(vatReturn.vat_input_23)}</r14d>
    <r15>${fmt(base19Input)}</r15><r15d>${fmt(vatReturn.vat_input_19)}</r15d>
    <r16>${fmt(base5Input)}</r16><r16d>${fmt(vatReturn.vat_input_5)}</r16d>
    <r17>0.00</r17><r17d>0.00</r17d>
    <r18>0.00</r18><r18d>0.00</r18d>
    <r19>0.00</r19><r19d>0.00</r19d>
    <r20>0.00</r20><r20d>0.00</r20d>
    <r21>0.00</r21><r22>0.00</r22><r23>0.00</r23>
    <r24>0.00</r24><r25>0.00</r25><r26>0.00</r26>
    <r27>${fmt(totalOutputVat)}</r27>
    <r28>${fmt(totalInputVat)}</r28>
    <r29>${fmt(toPay)}</r29>
    <r30>${fmt(overpayment)}</r30>
    <r31>${fmt(overpayment)}</r31>
    <r32>0.00</r32>
    <r33>${fmt(toPay)}</r33>
  </telo>
</DPDPHv2>`
}
