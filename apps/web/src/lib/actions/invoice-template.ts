"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { revalidatePath } from "next/cache"
import { DEFAULT_TEMPLATE_SETTINGS } from "@/lib/types/invoice-template"
import type { InvoiceTemplateSettings } from "@/lib/types/invoice-template"

export async function getInvoiceTemplateSettingsAction(): Promise<InvoiceTemplateSettings> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return DEFAULT_TEMPLATE_SETTINGS

  const { data } = await (supabase as any)
    .from("organizations")
    .select("invoice_template_settings")
    .eq("id", orgId)
    .single()

  if (!data?.invoice_template_settings) return DEFAULT_TEMPLATE_SETTINGS
  return { ...DEFAULT_TEMPLATE_SETTINGS, ...data.invoice_template_settings }
}

export async function updateInvoiceTemplateSettingsAction(
  settings: InvoiceTemplateSettings
): Promise<{ error?: string }> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const { error } = await (supabase as any)
    .from("organizations")
    .update({ invoice_template_settings: settings })
    .eq("id", orgId)

  if (error) return { error: error.message }

  revalidatePath("/settings/invoice-template")
  return {}
}
