/**
 * Legislative Service
 *
 * Provides access to centralized legislative rules (VAT rates,
 * retention periods, tax deadlines, filing requirements) by country.
 *
 * Usage:
 *   const rates = await getActiveVatRates(supabase, "SK")
 *   const period = await getRetentionPeriod(supabase, "SK", "invoice")
 *   const deadlines = await getUpcomingDeadlines(supabase, "SK", new Date())
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Types ───────────────────────────────────────────────────────────────────

export interface VatRate {
  key: string
  rate: number
  description: string
  validFrom: string
}

export interface RetentionPeriod {
  documentType: string
  years: number
  description: string
}

export interface TaxDeadline {
  key: string
  date: string
  period: string
  description: string
  daysUntil: number
}

export interface FilingRequirement {
  key: string
  frequency: string
  requiredFor: string
  description: string
}

interface LegislativeRule {
  id: string
  country_code: string
  rule_type: string
  key: string
  value: Record<string, unknown>
  valid_from: string
  valid_to: string | null
  description: string | null
}

// ─── VAT Rates ───────────────────────────────────────────────────────────────

export async function getActiveVatRates(
  supabase: SupabaseClient,
  countryCode: string = "SK",
  asOfDate?: Date
): Promise<VatRate[]> {
  try {
    const dateStr = (asOfDate ?? new Date()).toISOString().split("T")[0]

    let query = supabase
      .from("legislative_rules")
      .select("*")
      .eq("country_code", countryCode)
      .eq("rule_type", "vat_rate")
      .lte("valid_from", dateStr)
      .order("valid_from", { ascending: false })

    // Only active rules (no valid_to or valid_to >= asOfDate)
    query = query.or(`valid_to.is.null,valid_to.gte.${dateStr}`)

    const { data, error } = await query

    if (error) {
      console.error("[legislative] Failed to fetch VAT rates:", error.message)
      return []
    }

    const rules = (data ?? []) as unknown as LegislativeRule[]

    // Deduplicate by key (take the most recent valid_from per key)
    const seen = new Set<string>()
    const result: VatRate[] = []

    for (const rule of rules) {
      if (seen.has(rule.key)) continue
      seen.add(rule.key)
      result.push({
        key: rule.key,
        rate: (rule.value as { rate: number }).rate,
        description: rule.description ?? rule.key,
        validFrom: rule.valid_from,
      })
    }

    return result.sort((a, b) => b.rate - a.rate)
  } catch (err) {
    console.error("[legislative] Unexpected error fetching VAT rates:", err)
    return []
  }
}

// ─── Retention Periods ───────────────────────────────────────────────────────

export async function getRetentionPeriod(
  supabase: SupabaseClient,
  countryCode: string = "SK",
  documentType?: string
): Promise<RetentionPeriod[]> {
  try {
    let query = supabase
      .from("legislative_rules")
      .select("*")
      .eq("country_code", countryCode)
      .eq("rule_type", "retention_period")

    if (documentType) {
      query = query.eq("key", documentType)
    }

    const { data, error } = await query

    if (error) {
      console.error("[legislative] Failed to fetch retention periods:", error.message)
      return []
    }

    return ((data ?? []) as unknown as LegislativeRule[]).map(rule => ({
      documentType: rule.key,
      years: (rule.value as { years: number }).years,
      description: rule.description ?? rule.key,
    }))
  } catch (err) {
    console.error("[legislative] Unexpected error fetching retention periods:", err)
    return []
  }
}

// ─── Tax Deadlines ───────────────────────────────────────────────────────────

export async function getUpcomingDeadlines(
  supabase: SupabaseClient,
  countryCode: string = "SK",
  fromDate?: Date,
  daysAhead: number = 90
): Promise<TaxDeadline[]> {
  try {
    const from = fromDate ?? new Date()
    const toDate = new Date(from)
    toDate.setDate(toDate.getDate() + daysAhead)

    const fromStr = from.toISOString().split("T")[0]
    const toStr = toDate.toISOString().split("T")[0]

    const { data, error } = await supabase
      .from("legislative_rules")
      .select("*")
      .eq("country_code", countryCode)
      .eq("rule_type", "tax_deadline")
      .order("value->date", { ascending: true })

    if (error) {
      console.error("[legislative] Failed to fetch deadlines:", error.message)
      return []
    }

    const rules = (data ?? []) as unknown as LegislativeRule[]
    const now = from.getTime()

    return rules
      .filter(rule => {
        const deadline = (rule.value as { date: string }).date
        return deadline >= fromStr && deadline <= toStr
      })
      .map(rule => {
        const deadlineDate = (rule.value as { date: string }).date
        const daysUntil = Math.ceil(
          (new Date(deadlineDate).getTime() - now) / (1000 * 60 * 60 * 24)
        )
        return {
          key: rule.key,
          date: deadlineDate,
          period: (rule.value as { period: string }).period,
          description: rule.description ?? rule.key,
          daysUntil,
        }
      })
  } catch (err) {
    console.error("[legislative] Unexpected error fetching deadlines:", err)
    return []
  }
}

// ─── Filing Requirements ─────────────────────────────────────────────────────

export async function getFilingRequirements(
  supabase: SupabaseClient,
  countryCode: string = "SK"
): Promise<FilingRequirement[]> {
  try {
    const { data, error } = await supabase
      .from("legislative_rules")
      .select("*")
      .eq("country_code", countryCode)
      .eq("rule_type", "filing_requirement")

    if (error) {
      console.error("[legislative] Failed to fetch filing requirements:", error.message)
      return []
    }

    return ((data ?? []) as unknown as LegislativeRule[]).map(rule => ({
      key: rule.key,
      frequency: (rule.value as { frequency: string }).frequency,
      requiredFor: (rule.value as { required_for: string }).required_for,
      description: rule.description ?? rule.key,
    }))
  } catch (err) {
    console.error("[legislative] Unexpected error fetching filing requirements:", err)
    return []
  }
}
