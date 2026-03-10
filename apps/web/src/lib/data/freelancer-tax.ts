import { createClient } from "@/lib/supabase/server"
import { calculateFreelancerTax, SLOVAK_TAX_CONFIG_2025, type FreelancerTaxResult } from "@vexera/utils"

export interface FreelancerTaxData {
  taxResult: FreelancerTaxResult
  incomeYtd: number
  taxRegime: "pausalne_vydavky" | "naklady"
}

export async function getFreelancerTaxData(orgId: string): Promise<FreelancerTaxData> {
  const supabase = await createClient()
  const currentYear = new Date().getFullYear()
  const yearStart = `${currentYear}-01-01`

  // Get total income from paid issued invoices this year
  const { data: invoices } = await supabase
    .from("invoices")
    .select("total")
    .eq("organization_id", orgId)
    .eq("invoice_type", "issued")
    .eq("status", "paid")
    .gte("paid_at", yearStart)

  const incomeYtd = (invoices ?? []).reduce((sum, inv) => sum + (inv.total ?? 0), 0)

  // Get tax regime from freelancer_profiles
  // Cast to any since profile tables may not be in generated types yet
  const { data: profile } = await (supabase
    .from("freelancer_profiles") as any)
    .select("tax_regime")
    .eq("organization_id", orgId)
    .single()

  const taxRegime = (profile?.tax_regime ?? "pausalne_vydavky") as "pausalne_vydavky" | "naklady"
  const useFlatExpenses = taxRegime === "pausalne_vydavky"

  // For naklady: sum actual expenses from received invoices
  let actualExpenses = 0
  if (!useFlatExpenses) {
    const { data: expenses } = await supabase
      .from("invoices")
      .select("total")
      .eq("organization_id", orgId)
      .eq("invoice_type", "received")
      .gte("created_at", yearStart)
    actualExpenses = (expenses ?? []).reduce((sum, inv) => sum + (inv.total ?? 0), 0)
  }

  const taxResult = calculateFreelancerTax(
    incomeYtd,
    actualExpenses,
    useFlatExpenses,
    SLOVAK_TAX_CONFIG_2025,
  )

  return { taxResult, incomeYtd, taxRegime }
}
