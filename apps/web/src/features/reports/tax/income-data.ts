"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"
import {
  calculateFreelancerTax,
  SLOVAK_TAX_CONFIG_2025,
  SLOVAK_TAX_CONFIG_2026,
  type FreelancerTaxResult,
  type TaxConfig,
} from "@vexera/utils"

function getTaxConfig(year: number): TaxConfig {
  if (year <= 2025) return SLOVAK_TAX_CONFIG_2025
  return SLOVAK_TAX_CONFIG_2026
}

export interface IncomeTaxData {
  income: number
  expenses: number
  priorYearIncome: number
  taxRegime: "pausalne_vydavky" | "naklady"
  taxResult: FreelancerTaxResult
  filingDeadline: string | null
  isFreelancer: boolean
  config: TaxConfig
}

export async function getIncomeTaxDataAction(
  year: number,
): Promise<{ data?: IncomeTaxData; error?: string }> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const config = getTaxConfig(year)
  const priorConfig = getTaxConfig(year - 1)
  const yearStart = `${year}-01-01`
  const yearEnd = `${year + 1}-01-01`
  const priorYearStart = `${year - 1}-01-01`
  const priorYearEnd = `${year}-01-01`

  // 1. Fetch freelancer profile + organization VAT status
  const [{ data: profile }, { data: org }] = await Promise.all([
    supabase
      .from("freelancer_profiles")
      .select("tax_regime, registered_dph")
      .eq("organization_id", orgId)
      .single(),
    supabase
      .from("organizations")
      .select("ic_dph")
      .eq("id", orgId)
      .single(),
  ])

  const isFreelancer = !!profile
  const isVatPayer = !!profile?.registered_dph || !!org?.ic_dph
  const taxRegime: "pausalne_vydavky" | "naklady" =
    profile?.tax_regime === "naklady" ? "naklady" : "pausalne_vydavky"
  const useFlatExpenses = taxRegime === "pausalne_vydavky"

  // 2. Fetch current year income + expenses and prior year income + expenses in parallel
  //    For VAT payers, use subtotal (net without VAT) — VAT is not income, it's collected for the state
  const [
    { data: issuedInvoices },
    { data: receivedInvoices },
    { data: priorIssuedInvoices },
    { data: priorReceivedInvoices },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("subtotal, total")
      .eq("organization_id", orgId)
      .eq("invoice_type", "issued")
      .gte("issue_date", yearStart)
      .lt("issue_date", yearEnd),
    supabase
      .from("invoices")
      .select("subtotal, total")
      .eq("organization_id", orgId)
      .eq("invoice_type", "received")
      .gte("issue_date", yearStart)
      .lt("issue_date", yearEnd),
    supabase
      .from("invoices")
      .select("subtotal, total")
      .eq("organization_id", orgId)
      .eq("invoice_type", "issued")
      .gte("issue_date", priorYearStart)
      .lt("issue_date", priorYearEnd),
    supabase
      .from("invoices")
      .select("subtotal, total")
      .eq("organization_id", orgId)
      .eq("invoice_type", "received")
      .gte("issue_date", priorYearStart)
      .lt("issue_date", priorYearEnd),
  ])

  const amountField = isVatPayer ? "subtotal" : "total"
  const income = (issuedInvoices ?? []).reduce(
    (sum, inv) => sum + Number(inv[amountField] ?? 0),
    0,
  )
  const expenses = (receivedInvoices ?? []).reduce(
    (sum, inv) => sum + Number(inv[amountField] ?? 0),
    0,
  )
  const priorYearIncome = (priorIssuedInvoices ?? []).reduce(
    (sum, inv) => sum + Number(inv[amountField] ?? 0),
    0,
  )
  const priorYearExpenses = (priorReceivedInvoices ?? []).reduce(
    (sum, inv) => sum + Number(inv[amountField] ?? 0),
    0,
  )

  // 3. Odvody, ktoré platíš v `year`, sú vypočítané z príjmov za `year-1`
  //    (Sociálna poisťovňa prepočíta odvody po podaní daňového priznania za predchádzajúci rok)
  //    Zdravotná poisťovňa je pre SZČO fixná — platí sa vždy minimálna sadzba
  const priorResult = calculateFreelancerTax(priorYearIncome, priorYearExpenses, useFlatExpenses, priorConfig)
  const currentSocialMonthly = priorResult.socialMonthly
  const currentHealthMonthly = priorConfig.minHealthMonthly

  // 4. Vypočítaj daňové priznanie za `year` — odpočet poistného = skutočne zaplatené odvody (z minulého roka)
  const taxResult = calculateFreelancerTax(
    income,
    expenses,
    useFlatExpenses,
    config,
    {
      social: currentSocialMonthly * config.assessmentMonths,
      health: currentHealthMonthly * config.assessmentMonths,
    },
  )

  // 5. Budúcoročné odvody (od `year+1`) = vypočítané z príjmov za `year`
  const nextYearEstimate = calculateFreelancerTax(income, expenses, useFlatExpenses, config)

  // Zdravotná poisťovňa je pre SZČO fixná (minimálna sadzba) — nezávisí od príjmu
  const finalTaxResult: FreelancerTaxResult = {
    ...taxResult,
    socialMonthly: currentSocialMonthly,
    healthMonthly: priorConfig.minHealthMonthly,
    nextYearSocialMonthly: nextYearEstimate.socialMonthly,
    nextYearHealthMonthly: config.minHealthMonthly,
  }

  // 6. Filing deadline: March 31 of the following year
  const filingDeadline = `${year + 1}-03-31`

  return {
    data: {
      income,
      expenses,
      priorYearIncome,
      taxRegime,
      taxResult: finalTaxResult,
      filingDeadline,
      isFreelancer,
      config,
    },
  }
}
