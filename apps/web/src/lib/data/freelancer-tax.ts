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
  const { data: profile } = await (supabase
    .from("freelancer_profiles") as any)
    .select("tax_regime, is_first_year, founding_date, has_social_insurance, paid_social_monthly, is_disabled, registered_dph")
    .eq("organization_id", orgId)
    .single()

  const taxRegime = (profile?.tax_regime ?? "pausalne_vydavky") as "pausalne_vydavky" | "naklady"
  const useFlatExpenses = taxRegime === "pausalne_vydavky"

  // Build FreelancerTaxProfile from DB data
  const taxProfile: FreelancerTaxProfile = {
    taxRegime,
    isVatPayer: profile?.registered_dph ?? false,
    isFirstYear: profile?.is_first_year ?? false,
    foundingDate: profile?.founding_date ?? undefined,
    hasSocialInsurance: profile?.has_social_insurance ?? false,
    paidSocialMonthly: profile?.paid_social_monthly != null ? Number(profile.paid_social_monthly) : undefined,
    isDisabled: profile?.is_disabled ?? false,
  }

  // Fetch current year income, prior year income, and expenses in parallel
  const [
    { data: invoices },
    { data: priorInvoices },
    { data: expenseInvoices },
    { data: priorExpenseInvoices },
  ] = await Promise.all([
    supabase
      .from("invoices")
      .select("total")
      .eq("organization_id", orgId)
      .eq("invoice_type", "issued")
      .gte("issue_date", yearStart),
    (supabase as any)
      .from("invoices")
      .select("total")
      .eq("organization_id", orgId)
      .eq("invoice_type", "issued")
      .gte("issue_date", priorYearStart)
      .lt("issue_date", priorYearEnd),
    useFlatExpenses ? Promise.resolve({ data: [] }) : supabase
      .from("invoices")
      .select("total")
      .eq("organization_id", orgId)
      .eq("invoice_type", "received")
      .gte("issue_date", yearStart),
    useFlatExpenses ? Promise.resolve({ data: [] }) : (supabase as any)
      .from("invoices")
      .select("total")
      .eq("organization_id", orgId)
      .eq("invoice_type", "received")
      .gte("issue_date", priorYearStart)
      .lt("issue_date", priorYearEnd),
  ])

  const incomeYtd = (invoices ?? []).reduce((sum: number, inv: any) => sum + Number(inv.total ?? 0), 0)
  const priorYearIncome = (priorInvoices ?? []).reduce((sum: number, inv: any) => sum + Number(inv.total ?? 0), 0)
  const actualExpenses = (expenseInvoices ?? []).reduce((sum: number, inv: any) => sum + Number(inv.total ?? 0), 0)
  const priorYearExpenses = (priorExpenseInvoices ?? []).reduce((sum: number, inv: any) => sum + Number(inv.total ?? 0), 0)

  // Prior year calculation to determine current social insurance payments
  const priorResult = calculateFreelancerTaxV2(priorYearIncome, priorYearExpenses, taxProfile, priorLegislation)
  const currentSocialMonthly = priorResult.socialMonthly

  // Build a profile with known paid insurance for the current year calculation
  // Social payments are based on prior year income; health uses prior year minimum
  const currentYearProfile: FreelancerTaxProfile = {
    ...taxProfile,
    paidSocialMonthly: currentSocialMonthly,
    paidHealthMonthly: priorLegislation.insurance.minHealthMonthly,
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
    healthMonthly: priorLegislation.insurance.minHealthMonthly,
    nextYearSocialMonthly: nextYearEstimate.socialMonthly,
    nextYearHealthMonthly: nextYearEstimate.healthMonthly,
  }

  return { taxResult: finalTaxResult, incomeYtd, taxRegime }
}
