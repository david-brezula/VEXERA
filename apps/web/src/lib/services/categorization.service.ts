/**
 * Smart Categorization Service
 *
 * Learns from accountant corrections to auto-categorize future documents.
 *
 * Flow:
 *   1. Accountant corrects a document field (category, account_number, etc.)
 *   2. The correction is recorded via `recordCorrection`.
 *   3. On subsequent uploads, `suggestCategory` checks past corrections
 *      and returns a suggestion if a strong pattern exists.
 *   4. `applySuggestions` writes the suggestion directly to the document.
 *
 * All queries enforce organization_id scoping at the service layer.
 *
 * Usage:
 *   const supabase = await createClient()
 *   await recordCorrection(supabase, orgId, { ... })
 *   const suggestion = await suggestCategory(supabase, orgId, { ... })
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Input types ─────────────────────────────────────────────────────────────

export interface RecordCorrectionParams {
  documentId: string
  userId: string
  fieldName: string
  oldValue: string | null
  newValue: string
  source: "ocr" | "rule" | "manual"
}

export interface SuggestionInput {
  supplier_name: string | null
  total_amount: number | null
  description: string | null
}

export interface CategorySuggestion {
  category: string
  account_number: string
  confidence: number
}

export interface CategorizationStats {
  total_corrections: number
  unique_suppliers: number
  auto_categorize_rate: number
}

// ─── recordCorrection ────────────────────────────────────────────────────────

/**
 * Insert a correction record into the document_corrections table.
 * Called whenever an accountant edits a document field value.
 */
export async function recordCorrection(
  supabase: SupabaseClient,
  organizationId: string,
  params: RecordCorrectionParams
): Promise<{ id: string }> {
  const { data, error } = await supabase
    .from("document_corrections")
    .insert({
      organization_id: organizationId,
      document_id: params.documentId,
      user_id: params.userId,
      field_name: params.fieldName,
      old_value: params.oldValue,
      new_value: params.newValue,
      source: params.source,
    })
    .select("id")
    .single()

  if (error || !data) {
    throw new Error(`Failed to record correction: ${error?.message ?? "unknown error"}`)
  }

  return { id: (data as { id: string }).id }
}

// ─── suggestCategory ─────────────────────────────────────────────────────────

/**
 * Suggest a category and/or account_number for a document based on
 * historical corrections for similar suppliers.
 *
 * Scoring:
 *   - 3+ corrections to the same value → confidence 0.9
 *   - 1-2 corrections to the same value → confidence 0.6
 *   - No patterns found → returns null
 */
export async function suggestCategory(
  supabase: SupabaseClient,
  organizationId: string,
  document: SuggestionInput
): Promise<CategorySuggestion | null> {
  const supplierName = document.supplier_name?.trim().toLowerCase()
  if (!supplierName) return null

  // Fetch all corrections for category and account_number in this org
  const { data: corrections, error } = await supabase
    .from("document_corrections")
    .select("field_name, old_value, new_value, document_id")
    .eq("organization_id", organizationId)
    .in("field_name", ["category", "account_number"])

  if (error || !corrections || corrections.length === 0) return null

  // Collect the document IDs from corrections so we can look up their supplier names
  const docIds = [...new Set(corrections.map((c) => c.document_id as string))]

  const { data: docs, error: docsErr } = await supabase
    .from("documents")
    .select("id, ocr_data")
    .in("id", docIds)

  if (docsErr || !docs) return null

  // Build a map: document_id → supplier_name (normalised)
  const docSupplierMap = new Map<string, string>()
  for (const doc of docs) {
    const ocr = (doc.ocr_data ?? {}) as Record<string, unknown>
    const name = (ocr.supplier_name as string | null)?.trim().toLowerCase()
    if (name) {
      docSupplierMap.set(doc.id as string, name)
    }
  }

  // Filter corrections to those whose document has a matching supplier name
  const relevantCorrections = corrections.filter((c) => {
    const docSupplier = docSupplierMap.get(c.document_id as string)
    return docSupplier === supplierName
  })

  if (relevantCorrections.length === 0) return null

  // Group by field_name → new_value → count
  const categoryResult = findMostCommonValue(
    relevantCorrections.filter((c) => c.field_name === "category")
  )
  const accountResult = findMostCommonValue(
    relevantCorrections.filter((c) => c.field_name === "account_number")
  )

  // If neither field has a pattern, return null
  if (!categoryResult && !accountResult) return null

  // Use the higher confidence between the two
  const confidence = Math.max(
    categoryResult?.confidence ?? 0,
    accountResult?.confidence ?? 0
  )

  return {
    category: categoryResult?.value ?? "",
    account_number: accountResult?.value ?? "",
    confidence,
  }
}

// ─── applySuggestions ────────────────────────────────────────────────────────

/**
 * Look up a suggestion for the given document and apply it if confidence >= 0.6.
 * Returns whether a suggestion was applied.
 */
export async function applySuggestions(
  supabase: SupabaseClient,
  organizationId: string,
  documentId: string
): Promise<{
  applied: boolean
  category?: string
  account_number?: string
  confidence?: number
}> {
  // Fetch the document to get supplier info
  const { data: doc, error: docErr } = await supabase
    .from("documents")
    .select("id, ocr_data")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .single()

  if (docErr || !doc) return { applied: false }

  const ocr = (doc.ocr_data ?? {}) as Record<string, unknown>

  const suggestion = await suggestCategory(supabase, organizationId, {
    supplier_name: (ocr.supplier_name as string) ?? null,
    total_amount: (ocr.total_amount as number) ?? null,
    description: (ocr.raw_text as string) ?? null,
  })

  if (!suggestion || suggestion.confidence < 0.6) {
    return { applied: false }
  }

  // Build the update patch — only include non-empty fields
  const patch: Record<string, string> = {}
  if (suggestion.category) patch.category = suggestion.category
  if (suggestion.account_number) patch.account_number = suggestion.account_number

  if (Object.keys(patch).length === 0) return { applied: false }

  // Apply the suggestion to the document's ocr_data (merged)
  const updatedOcr = { ...ocr, ...patch }

  const { error: updateErr } = await supabase
    .from("documents")
    .update({ ocr_data: updatedOcr })
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  if (updateErr) {
    throw new Error(`Failed to apply suggestions: ${updateErr.message}`)
  }

  return {
    applied: true,
    category: suggestion.category || undefined,
    account_number: suggestion.account_number || undefined,
    confidence: suggestion.confidence,
  }
}

// ─── getCategorizationStats ──────────────────────────────────────────────────

/**
 * Return categorization statistics for the dashboard.
 */
export async function getCategorizationStats(
  supabase: SupabaseClient,
  organizationId: string
): Promise<CategorizationStats> {
  // Total corrections
  const { count: totalCorrections, error: countErr } = await supabase
    .from("document_corrections")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)

  if (countErr) {
    throw new Error(`Failed to count corrections: ${countErr.message}`)
  }

  // Unique suppliers that have been corrected
  const { data: correctedDocs, error: docsErr } = await supabase
    .from("document_corrections")
    .select("document_id")
    .eq("organization_id", organizationId)

  if (docsErr) {
    throw new Error(`Failed to fetch correction docs: ${docsErr.message}`)
  }

  let uniqueSuppliers = 0
  if (correctedDocs && correctedDocs.length > 0) {
    const docIds = [...new Set(correctedDocs.map((c) => c.document_id as string))]

    const { data: docs } = await supabase
      .from("documents")
      .select("ocr_data")
      .in("id", docIds)

    if (docs) {
      const suppliers = new Set<string>()
      for (const doc of docs) {
        const ocr = (doc.ocr_data ?? {}) as Record<string, unknown>
        const name = (ocr.supplier_name as string | null)?.trim().toLowerCase()
        if (name) suppliers.add(name)
      }
      uniqueSuppliers = suppliers.size
    }
  }

  // Auto-categorize rate: docs with category in ocr_data / total docs
  const { count: totalDocs } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  const { count: categorizedDocs } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .not("ocr_data->category", "is", null)

  const autoRate =
    totalDocs && totalDocs > 0
      ? Math.round(((categorizedDocs ?? 0) / totalDocs) * 100)
      : 0

  return {
    total_corrections: totalCorrections ?? 0,
    unique_suppliers: uniqueSuppliers,
    auto_categorize_rate: autoRate,
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface ValueCount {
  value: string
  confidence: number
}

/**
 * Find the most common `new_value` in a set of corrections.
 * Returns null if no corrections are provided.
 */
function findMostCommonValue(
  corrections: { new_value: unknown }[]
): ValueCount | null {
  if (corrections.length === 0) return null

  const counts = new Map<string, number>()
  for (const c of corrections) {
    const val = c.new_value as string
    counts.set(val, (counts.get(val) ?? 0) + 1)
  }

  // Find the value with the highest count
  let bestValue = ""
  let bestCount = 0
  for (const [val, count] of counts) {
    if (count > bestCount) {
      bestValue = val
      bestCount = count
    }
  }

  if (!bestValue) return null

  // 3+ corrections → 0.9, 1-2 → 0.6
  const confidence = bestCount >= 3 ? 0.9 : 0.6

  return { value: bestValue, confidence }
}
