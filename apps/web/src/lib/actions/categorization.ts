"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { suggestCategory, suggestCategoryBySupplier, recordCorrection } from "@/lib/services/categorization.service"

export async function getSuggestionsAction(input: {
  supplier_name: string | null
  total_amount: number | null
  description: string | null
}): Promise<{ category: string; account_number: string; confidence: number }[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []

  const suggestions: { category: string; account_number: string; confidence: number }[] = []

  const primary = await suggestCategory(supabase, orgId, input)
  if (primary) suggestions.push(primary)

  if (input.supplier_name) {
    const bySupplier = await suggestCategoryBySupplier(supabase, orgId, input.supplier_name)
    if (bySupplier && !suggestions.find(s => s.category === bySupplier.category)) {
      suggestions.push(bySupplier)
    }
  }

  return suggestions.slice(0, 3)
}

export async function acceptSuggestionAction(
  documentId: string,
  category: string,
  accountNumber: string
): Promise<{ error?: string }> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const { error } = await (supabase.from("documents" as any) as any)
    .update({ category, account_number: accountNumber, auto_categorized: true })
    .eq("id", documentId)

  if (error) return { error: error.message }

  await recordCorrection(supabase, orgId, {
    documentId,
    userId: "",
    fieldName: "category",
    oldValue: null,
    newValue: category,
    source: "manual",
  })

  return {}
}

export async function dismissSuggestionAction(
  documentId: string,
  category: string
): Promise<void> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return

  await recordCorrection(supabase, orgId, {
    documentId,
    userId: "",
    fieldName: "category",
    oldValue: category,
    newValue: "__dismissed__",
    source: "manual",
  })
}
