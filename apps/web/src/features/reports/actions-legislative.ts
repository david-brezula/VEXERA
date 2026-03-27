"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveVatRates, getUpcomingDeadlines, getFilingRequirements } from "@/shared/services/legislative.service"

export async function getActiveVatRatesAction() {
  const supabase = await createClient()
  return getActiveVatRates(supabase, "SK")
}

export async function getUpcomingDeadlinesAction(daysAhead = 90) {
  const supabase = await createClient()
  return getUpcomingDeadlines(supabase, "SK", new Date(), daysAhead)
}

export async function getFilingRequirementsAction() {
  const supabase = await createClient()
  return getFilingRequirements(supabase, "SK")
}
