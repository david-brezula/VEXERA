"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"

// ─── deleteDocumentAction ─────────────────────────────────────────────────────

export async function deleteDocumentAction(
  documentId: string
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const { error } = await supabase
      .from("documents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", documentId)
      .eq("organization_id", orgId)

    if (error) return { error: error.message }

    revalidatePath("/documents")
    revalidatePath("/")
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── linkDocumentToInvoiceAction ──────────────────────────────────────────────

export async function linkDocumentToInvoiceAction(
  documentId: string,
  invoiceId: string | null
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const { error } = await supabase
      .from("documents")
      .update({ invoice_id: invoiceId })
      .eq("id", documentId)
      .eq("organization_id", orgId)

    if (error) return { error: error.message }

    revalidatePath("/documents")
    if (invoiceId) revalidatePath(`/invoices/${invoiceId}`)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}
