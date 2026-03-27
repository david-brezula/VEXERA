"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"
import { revalidatePath } from "next/cache"
import { DEFAULT_TEMPLATE_SETTINGS, DEFAULT_NUMBERING_FORMAT } from "./types"
import type { InvoiceTemplateSettings } from "./types"
import type { Json } from "@vexera/types"

export async function getInvoiceTemplateSettingsAction(): Promise<InvoiceTemplateSettings> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return DEFAULT_TEMPLATE_SETTINGS

  const { data } = await supabase
    .from("organizations")
    .select("invoice_template_settings")
    .eq("id", orgId)
    .single()

  if (!data?.invoice_template_settings) return DEFAULT_TEMPLATE_SETTINGS
  const stored = data.invoice_template_settings as unknown as Partial<InvoiceTemplateSettings>
  return {
    ...DEFAULT_TEMPLATE_SETTINGS,
    ...stored,
    numberingFormat: {
      ...DEFAULT_NUMBERING_FORMAT,
      ...(stored.numberingFormat ?? {}),
    },
  }
}

export async function updateInvoiceTemplateSettingsAction(
  settings: InvoiceTemplateSettings
): Promise<{ error?: string }> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const { error } = await supabase
    .from("organizations")
    .update({ invoice_template_settings: settings as unknown as Json })
    .eq("id", orgId)

  if (error) return { error: error.message }

  revalidatePath("/settings/invoice-template")
  return {}
}
