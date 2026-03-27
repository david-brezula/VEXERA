import { createClient } from "@/lib/supabase/server"
import {
  calculateFreelancerTaxV2,
  getLegislation,
  type FreelancerTaxResultV2,
  type FreelancerTaxProfile,
} from "@vexera/utils"

export interface FreelancerTaxData {
  taxResult: FreelancerTaxResultV2
  incomeYtd: number
  taxRegime: "pausalne_vydavky" | "naklady"
}

export async function getFreelancerTaxData(orgId: string): Promise<FreelancerTaxData> {
  const supabase = await createClient()
  const currentYear = new Date().getFullYear()
  const yearStart = `${currentYear}-01-01`
  const priorYearStart = `${currentYear - 1}-01-01`
  const priorYearEnd = `${currentYear}-01-01`

  const legislation = getLegislation(currentYear)
  const priorLegislation = getLegislation(currentYear - 1)

  // Get freelancer profile with new columns
  const { data: profile } = await supabase
    .from("freelancer_profiles")
    .select("tax_regime, is_first_year, founding_date, has_social_insurance, paid_social_monthly, paid_health_monthly, is_disabled, is_student, is_pensioner, has_other_employment, registered_dph")
    .eq("organization_id", orgId)
    .single()

  const taxRegime = (profile?.tax_regime ?? "pausalne_vydavky") as "pausalne_vydavky" | "naklady"
  const useFlatExpenses = taxRegime === "pausalne_vydavky"

  // Dynamically compute isFirstYear from founding_date (don't rely on static DB flag)
  const foundingDate = profile?.founding_date ?? undefined
  const isFirstYear = (() => {
    if (!foundingDate) return profile?.is_first_year ?? false
    const founded = new Date(foundingDate)
    const now = new Date()
    const monthsDiff =
      (now.getFullYear() - founded.getFullYear()) * 12 +
      (now.getMonth() - founded.getMonth())
    return monthsDiff < 12
  })()

  // Build FreelancerTaxProfile from DB data
  const taxProfile: FreelancerTaxProfile = {
    taxRegime,
    isVatPayer: profile?.registered_dph ?? false,
    isFirstYear,
    foundingDate,
    hasSocialInsurance: profile?.has_social_insurance ?? false,
    paidSocialMonthly: profile?.paid_social_monthly != null ? Number(profile.paid_social_monthly) : undefined,
    isDisabled: profile?.is_disabled ?? false,
    isStudent: profile?.is_student ?? false,
    isPensioner: profile?.is_pensioner ?? false,
    hasOtherEmployment: profile?.has_other_employment ?? false,
  }

  // Fetch current year income, prior year income, and expenses in parallel
  // For VAT payers, use subtotal (without VAT) — VAT is not income, it's collected for the state
  const isVatPayer = taxProfile.isVatPayer
  const [
    { data: invoices },
    { data: priorInvoices },
    { data: expenseInvoices },
    { data: priorExpenseInvoices },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("subtotal, total")
      .eq("organization_id", orgId)
      .eq("invoice_type", "issued")
      .gte("issue_date", yearStart),
    supabase
      .from("invoices")
      .select("subtotal, total")
      .eq("organization_id", orgId)
      .eq("invoice_type", "issued")
      .gte("issue_date", priorYearStart)
      .lt("issue_date", priorYearEnd),
    useFlatExpenses ? Promise.resolve({ data: [] as { subtotal: number; total: number }[] }) : supabase
      .from("invoices")
      .select("subtotal, total")
      .eq("organization_id", orgId)
      .eq("invoice_type", "received")
      .gte("issue_date", yearStart),
    useFlatExpenses ? Promise.resolve({ data: [] as { subtotal: number; total: number }[] }) : supabase
      .from("invoices")
      .select("subtotal, total")
      .eq("organization_id", orgId)
      .eq("invoice_type", "received")
      .gte("issue_date", priorYearStart)
      .lt("issue_date", priorYearEnd),
  ])

  const amountField = isVatPayer ? "subtotal" : "total"
  const incomeYtd = (invoices ?? []).reduce((sum, inv) => sum + Number(inv[amountField] ?? 0), 0)
  const priorYearIncome = (priorInvoices ?? []).reduce((sum, inv) => sum + Number(inv[amountField] ?? 0), 0)
  const actualExpenses = (expenseInvoices ?? []).reduce((sum, inv) => sum + Number(inv[amountField] ?? 0), 0)
  const priorYearExpenses = (priorExpenseInvoices ?? []).reduce((sum, inv) => sum + Number(inv[amountField] ?? 0), 0)

  // Prior year calculation to determine current insurance payments
  // Slovak law: current year insurance is based on prior year income, respecting exemptions
  const priorResult = calculateFreelancerTaxV2(priorYearIncome, priorYearExpenses, taxProfile, priorLegislation)
  const currentSocialMonthly = priorResult.socialMonthly
  const currentHealthMonthly = priorResult.healthMonthly

  // Build a profile with known paid insurance for the current year tax calculation
  const currentYearProfile: FreelancerTaxProfile = {
    ...taxProfile,
    paidSocialMonthly: currentSocialMonthly,
    paidHealthMonthly: currentHealthMonthly,
  }

  const taxResult = calculateFreelancerTaxV2(
    incomeYtd,
    actualExpenses,
    currentYearProfile,
    legislation,
  )

  // Estimate next year insurance from current year income (without overriding paid amounts)
  const nextYearEstimate = calculateFreelancerTaxV2(incomeYtd, actualExpenses, taxProfile, legislation)

  const finalTaxResult: FreelancerTaxResultV2 = {
    ...taxResult,
    socialMonthly: currentSocialMonthly,
    healthMonthly: currentHealthMonthly,
    nextYearSocialMonthly: nextYearEstimate.socialMonthly,
    nextYearHealthMonthly: nextYearEstimate.healthMonthly,
  }

  return { taxResult: finalTaxResult, incomeYtd, taxRegime }
}
