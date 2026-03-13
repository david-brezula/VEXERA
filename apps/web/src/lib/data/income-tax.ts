"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import {
  calculateFreelancerTax,
  SLOVAK_TAX_CONFIG_2026,
  type FreelancerTaxResult,
  type TaxConfig,
} from "@vexera/utils"

export interface IncomeTaxData {
  income: number
  expenses: number
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

  const config = SLOVAK_TAX_CONFIG_2026
  const yearStart = `${year}-01-01`
  const yearEnd = `${year + 1}-01-01`

  // 1. Fetch freelancer profile for tax regime
  const { data: profile } = await (supabase as any)
    .from("freelancer_profiles")
    .select("tax_regime")
    .eq("organization_id", orgId)
    .single()

  const isFreelancer = !!profile
  const taxRegime: "pausalne_vydavky" | "naklady" =
    profile?.tax_regime === "naklady" ? "naklady" : "pausalne_vydavky"

  // 2. Fetch YTD income (sum of issued invoices total_amount)
  const { data: issuedInvoices } = await (supabase as any)
    .from("invoices")
    .select("total_amount")
    .eq("organization_id", orgId)
    .eq("invoice_type", "issued")
    .gte("issue_date", yearStart)
    .lt("issue_date", yearEnd)

  const income = (issuedInvoices ?? []).reduce(
    (sum: number, inv: any) => sum + Number(inv.total_amount ?? 0),
    0,
  )

  // 3. Fetch YTD expenses (sum of received invoices total_amount)
  const { data: receivedInvoices } = await (supabase as any)
    .from("invoices")
    .select("total_amount")
    .eq("organization_id", orgId)
    .eq("invoice_type", "received")
    .gte("issue_date", yearStart)
    .lt("issue_date", yearEnd)

  const expenses = (receivedInvoices ?? []).reduce(
    (sum: number, inv: any) => sum + Number(inv.total_amount ?? 0),
    0,
  )

  // 4. Calculate tax
  const useFlatExpenses = taxRegime === "pausalne_vydavky"
  const taxResult = calculateFreelancerTax(income, expenses, useFlatExpenses, config)

  // 5. Filing deadline: March 31 of the following year
  const filingDeadline = `${year + 1}-03-31`

  return {
    data: {
      income,
      expenses,
      taxRegime,
      taxResult,
      filingDeadline,
      isFreelancer,
      config,
    },
  }
}
