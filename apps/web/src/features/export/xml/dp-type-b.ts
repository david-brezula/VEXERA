// DP Type B (Danove Priznanie FO typ B) XML generator
// Income tax return for freelancers per Slovak Financial Administration specification

import {
  calculateFreelancerTax,
  type TaxConfig,
} from "@vexera/utils"

export interface DpTypeBInput {
  taxpayer: {
    dic: string
    full_name: string
    address_street: string
    address_city: string
    address_zip: string
  }
  year: number
  filingType: "R" | "O" | "D"
  income: number
  expenses: number
  taxRegime: "pausalne_vydavky" | "naklady"
  taxConfig: TaxConfig
  prepayments: number
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

function splitName(fullName: string): { firstName: string; surname: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length <= 1) {
    return { firstName: "", surname: parts[0] ?? "" }
  }
  const surname = parts[parts.length - 1]!
  const firstName = parts.slice(0, -1).join(" ")
  return { firstName, surname }
}

export function generateDpTypeBXml(input: DpTypeBInput): string {
  const { taxpayer, year, filingType, income, expenses, taxRegime, taxConfig, prepayments } = input

  const useFlatExpenses = taxRegime === "pausalne_vydavky"
  const result = calculateFreelancerTax(income, expenses, useFlatExpenses, taxConfig)

  const { firstName, surname } = splitName(taxpayer.full_name)

  const grossIncome = round2(income)
  const expenseAmount = result.expenseDeduction
  const expenseMethod = useFlatExpenses ? 1 : 2
  const flatExpenseAmount = useFlatExpenses ? expenseAmount : 0

  // Partial tax base = income - expenses (before nezdanitelna ciastka)
  const partialTaxBase = round2(Math.max(0, grossIncome - expenseAmount))
  // Insurance deduction
  const insuranceDeduction = result.insuranceDeduction
  // Partial base after insurance
  const partialAfterInsurance = round2(Math.max(0, partialTaxBase - insuranceDeduction))
  // Nezdanitelna ciastka
  const nezdanitelnaCiastka = taxConfig.nezdanitelnaČiastka
  // Adjusted tax base
  const adjustedTaxBase = result.taxBase
  // Computed tax
  const computedTax = result.estimatedTax
  // To pay or refund
  const toPayOrRefund = round2(computedTax - prepayments)

  // Insurance bases
  const socialInsuranceBase = round2(partialTaxBase / 2)
  const healthInsuranceBase = round2(partialTaxBase / 2)

  return `<?xml version="1.0" encoding="UTF-8"?>
<DPFOBv21 xmlns="http://www.financnasprava.sk/DPFOBv21">
  <hlavicka>
    <dic>${escapeXml(taxpayer.dic)}</dic>
    <rok>${year}</rok>
    <druhPriznania>${filingType}</druhPriznania>
  </hlavicka>
  <identifikacia>
    <priezvisko>${escapeXml(surname)}</priezvisko>
    <meno>${escapeXml(firstName)}</meno>
    <ulica>${escapeXml(taxpayer.address_street)}</ulica>
    <obec>${escapeXml(taxpayer.address_city)}</obec>
    <psc>${escapeXml(taxpayer.address_zip)}</psc>
    <stat>SK</stat>
  </identifikacia>
  <telo>
    <r03301>${fmt(grossIncome)}</r03301>
    <r03302>${fmt(expenseAmount)}</r03302>
    <r04>${expenseMethod}</r04>
    <r04a>${fmt(flatExpenseAmount)}</r04a>
    <r05>${fmt(partialAfterInsurance)}</r05>
    <r05a>${fmt(partialAfterInsurance)}</r05a>
    <r06>${fmt(nezdanitelnaCiastka)}</r06>
    <r06a>${fmt(adjustedTaxBase)}</r06a>
    <r06b>${fmt(computedTax)}</r06b>
    <r07>${fmt(computedTax)}</r07>
    <r07a>${fmt(prepayments)}</r07a>
    <r07b>${fmt(toPayOrRefund)}</r07b>
    <r08>${fmt(socialInsuranceBase)}</r08>
    <r08a>${fmt(healthInsuranceBase)}</r08a>
  </telo>
</DPFOBv21>`
}
