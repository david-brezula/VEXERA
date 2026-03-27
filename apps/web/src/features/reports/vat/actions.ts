"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"
import { calculateVatReturn } from "@/features/reports/vat/service"

export async function computeVatReturnAction(year: number, month: number) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  // Check if org is DPH registered (freelancer or company profile)
  const { data: freelancerProfile } = await supabase
    .from("freelancer_profiles")
    .select("registered_dph")
    .eq("organization_id", orgId)
    .maybeSingle()

  if (freelancerProfile && !freelancerProfile.registered_dph) {
    return { error: "Organizácia nie je platcom DPH. Výkaz DPH nie je možné vytvoriť." }
  }

  const { data: companyProfile } = await supabase
    .from("company_profiles")
    .select("dph_status")
    .eq("organization_id", orgId)
    .maybeSingle()

  if (companyProfile && companyProfile.dph_status === "neplatca") {
    return { error: "Organizácia nie je platcom DPH. Výkaz DPH nie je možné vytvoriť." }
  }

  try {
    const result = await calculateVatReturn(supabase, orgId, year, month)
    revalidatePath("/tax/vat")
    return { data: result }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Failed to compute VAT return" }
  }
}

export async function getVatReturnsAction(year: number) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const { data, error } = await supabase
    .from("vat_returns")
    .select("*")
    .eq("organization_id", orgId)
    .eq("period_year", year)
    .order("period_month", { ascending: true })

  if (error) return { error: error.message }
  return { data: data ?? [] }
}

export async function getVatReturnDetailAction(year: number, month: number) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  // Fetch the VAT return
  const { data: vatReturn, error } = await supabase
    .from("vat_returns")
    .select("*")
    .eq("organization_id", orgId)
    .eq("period_year", year)
    .eq("period_month", month)
    .single()

  if (error) return { error: error.message }

  // Fetch contributing invoices for the period
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`
  const endMonth = month === 12 ? 1 : month + 1
  const endYear = month === 12 ? year + 1 : year
  const endDate = `${endYear}-${String(endMonth).padStart(2, "0")}-01`

  const { data: invoices } = await supabase
    .from("invoices")
    .select(
      "id, invoice_number, invoice_type, issue_date, total, vat_amount, supplier_name, customer_name"
    )
    .eq("organization_id", orgId)
    .gte("issue_date", startDate)
    .lt("issue_date", endDate)

  return { data: vatReturn, invoices: invoices ?? [] }
}

export async function finalizeVatReturnAction(year: number, month: number) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Validate status is draft
  const { data: current } = await supabase
    .from("vat_returns")
    .select("status")
    .eq("organization_id", orgId)
    .eq("period_year", year)
    .eq("period_month", month)
    .single()

  if (!current) return { error: "VAT return not found" }
  if (current.status !== "draft") return { error: "Only draft returns can be finalized" }

  const { error } = await supabase
    .from("vat_returns")
    .update({
      status: "final",
      finalized_at: new Date().toISOString(),
      finalized_by: user.id,
    })
    .eq("organization_id", orgId)
    .eq("period_year", year)
    .eq("period_month", month)

  if (error) return { error: error.message }

  revalidatePath("/tax/vat")
  return { success: true }
}

export async function revertVatReturnAction(year: number, month: number) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const { data: current } = await supabase
    .from("vat_returns")
    .select("status")
    .eq("organization_id", orgId)
    .eq("period_year", year)
    .eq("period_month", month)
    .single()

  if (!current) return { error: "VAT return not found" }
  if (current.status !== "final") return { error: "Only finalized returns can be reverted" }

  const { error } = await supabase
    .from("vat_returns")
    .update({ status: "draft", finalized_at: null, finalized_by: null })
    .eq("organization_id", orgId)
    .eq("period_year", year)
    .eq("period_month", month)

  if (error) return { error: error.message }

  revalidatePath("/tax/vat")
  return { success: true }
}

export async function markVatReturnSubmittedAction(year: number, month: number) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const { data: current } = await supabase
    .from("vat_returns")
    .select("status")
    .eq("organization_id", orgId)
    .eq("period_year", year)
    .eq("period_month", month)
    .single()

  if (!current) return { error: "VAT return not found" }
  if (current.status !== "final")
    return { error: "Only finalized returns can be marked as submitted" }

  const { error } = await supabase
    .from("vat_returns")
    .update({ status: "submitted" })
    .eq("organization_id", orgId)
    .eq("period_year", year)
    .eq("period_month", month)

  if (error) return { error: error.message }

  revalidatePath("/tax/vat")
  return { success: true }
}

export async function updateVatReturnNotesAction(
  year: number,
  month: number,
  notes: string
) {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const { error } = await supabase
    .from("vat_returns")
    .update({ notes })
    .eq("organization_id", orgId)
    .eq("period_year", year)
    .eq("period_month", month)

  if (error) return { error: error.message }
  return { success: true }
}

export async function getOrgFilingFrequencyAction(): Promise<{
  data?: string
  error?: string
}> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const { data, error } = await supabase
    .from("organizations")
    .select("filing_frequency")
    .eq("id", orgId)
    .single()

  if (error) return { error: error.message }
  return { data: data?.filing_frequency ?? "monthly" }
}
