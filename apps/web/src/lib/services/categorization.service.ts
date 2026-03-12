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
  issue_date?: string | null
}

// ML scoring weights
const WEIGHT_SUPPLIER = 0.4
const WEIGHT_AMOUNT = 0.2
const WEIGHT_TEXT = 0.3
const WEIGHT_TEMPORAL = 0.1

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
 * Suggest a category and/or account_number for a document using
 * multi-factor ML scoring from historical corrections.
 *
 * Scoring factors:
 *   - Supplier name match (weight 0.4) — exact and fuzzy matching
 *   - Amount range similarity (weight 0.2) — within ±30% of historical amounts
 *   - OCR text keyword TF-IDF scoring (weight 0.3) — keyword overlap
 *   - Temporal patterns (weight 0.1) — month-of-year patterns
 */
export async function suggestCategory(
  supabase: SupabaseClient,
  organizationId: string,
  document: SuggestionInput
): Promise<CategorySuggestion | null> {
  // Fetch all corrections for category and account_number in this org
  const { data: corrections, error } = await supabase
    .from("document_corrections")
    .select("field_name, old_value, new_value, document_id, created_at")
    .eq("organization_id", organizationId)
    .in("field_name", ["category", "account_number"])

  if (error || !corrections || corrections.length === 0) return null

  // Collect the document IDs from corrections so we can look up their details
  const docIds = [...new Set(corrections.map((c) => c.document_id as string))]

  const { data: docs, error: docsErr } = await supabase
    .from("documents")
    .select("id, ocr_data, total_amount, issue_date")
    .in("id", docIds)

  if (docsErr || !docs) return null

  // Build rich document context map
  const docContextMap = new Map<string, {
    supplierName: string
    amount: number | null
    text: string
    month: number | null
  }>()

  for (const doc of docs) {
    const ocr = (doc.ocr_data ?? {}) as Record<string, unknown>
    const name = (ocr.supplier_name as string | null)?.trim().toLowerCase() ?? ""
    const rawText = (ocr.raw_text as string | null) ?? ""
    const issueDate = doc.issue_date as string | null
    const month = issueDate ? new Date(issueDate).getMonth() : null

    docContextMap.set(doc.id as string, {
      supplierName: name,
      amount: doc.total_amount as number | null,
      text: rawText.toLowerCase(),
      month,
    })
  }

  // Score each correction against the input document
  const supplierName = document.supplier_name?.trim().toLowerCase() ?? ""
  const inputAmount = document.total_amount
  const inputText = (document.description ?? "").toLowerCase()
  const inputKeywords = extractKeywords(inputText)
  const inputMonth = document.issue_date ? new Date(document.issue_date).getMonth() : null

  interface ScoredCorrection {
    fieldName: string
    newValue: string
    score: number
  }

  const scoredCorrections: ScoredCorrection[] = []

  for (const corr of corrections) {
    const ctx = docContextMap.get(corr.document_id as string)
    if (!ctx) continue

    let score = 0

    // Factor 1: Supplier name match (weight 0.4)
    if (supplierName && ctx.supplierName) {
      if (ctx.supplierName === supplierName) {
        score += WEIGHT_SUPPLIER * 1.0
      } else if (ctx.supplierName.includes(supplierName) || supplierName.includes(ctx.supplierName)) {
        score += WEIGHT_SUPPLIER * 0.6
      }
    }

    // Factor 2: Amount range similarity (weight 0.2)
    if (inputAmount && ctx.amount && ctx.amount > 0) {
      const ratio = Math.min(inputAmount, ctx.amount) / Math.max(inputAmount, ctx.amount)
      if (ratio >= 0.7) {
        score += WEIGHT_AMOUNT * ratio
      }
    }

    // Factor 3: Text keyword overlap / TF-IDF-like scoring (weight 0.3)
    if (inputKeywords.length > 0 && ctx.text) {
      const corrKeywords = extractKeywords(ctx.text)
      if (corrKeywords.length > 0) {
        const overlap = inputKeywords.filter((k) => corrKeywords.includes(k)).length
        const similarity = overlap / Math.max(inputKeywords.length, 1)
        score += WEIGHT_TEXT * Math.min(similarity * 1.5, 1.0)
      }
    }

    // Factor 4: Temporal patterns (weight 0.1)
    if (inputMonth !== null && ctx.month !== null) {
      if (ctx.month === inputMonth) {
        score += WEIGHT_TEMPORAL * 1.0
      } else if (Math.abs(ctx.month - inputMonth) <= 1 || Math.abs(ctx.month - inputMonth) === 11) {
        score += WEIGHT_TEMPORAL * 0.5
      }
    }

    if (score > 0) {
      scoredCorrections.push({
        fieldName: corr.field_name as string,
        newValue: corr.new_value as string,
        score,
      })
    }
  }

  if (scoredCorrections.length === 0) return null

  // Find best category and account_number by weighted voting
  const categoryResult = findBestByWeightedVote(
    scoredCorrections.filter((c) => c.fieldName === "category")
  )
  const accountResult = findBestByWeightedVote(
    scoredCorrections.filter((c) => c.fieldName === "account_number")
  )

  if (!categoryResult && !accountResult) return null

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

/**
 * Legacy supplier-only suggestion for backward compatibility.
 */
export async function suggestCategoryBySupplier(
  supabase: SupabaseClient,
  organizationId: string,
  supplierName: string
): Promise<CategorySuggestion | null> {
  return suggestCategory(supabase, organizationId, {
    supplier_name: supplierName,
    total_amount: null,
    description: null,
  })
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

// ─── Correction Insights ────────────────────────────────────────────────────

export interface CorrectionInsight {
  category: string
  correctionCount: number
  accuracyTrend: "improving" | "stable" | "declining"
  topSuppliers: string[]
}

/**
 * Get insights about categorization corrections for the dashboard.
 * Shows top corrected categories, accuracy trends, and common suppliers.
 */
export async function getCorrectionInsights(
  supabase: SupabaseClient,
  organizationId: string
): Promise<CorrectionInsight[]> {
  const { data: corrections } = await supabase
    .from("document_corrections")
    .select("field_name, new_value, document_id, created_at")
    .eq("organization_id", organizationId)
    .eq("field_name", "category")
    .order("created_at", { ascending: false })
    .limit(500)

  if (!corrections || corrections.length === 0) return []

  const typedCorrections = corrections as unknown as {
    new_value: string; document_id: string; created_at: string
  }[]

  // Group by category
  const categoryMap = new Map<string, { count: number; docIds: Set<string>; dates: Date[] }>()
  for (const c of typedCorrections) {
    const cat = c.new_value
    const entry = categoryMap.get(cat) ?? { count: 0, docIds: new Set<string>(), dates: [] }
    entry.count++
    entry.docIds.add(c.document_id)
    entry.dates.push(new Date(c.created_at))
    categoryMap.set(cat, entry)
  }

  // Fetch supplier names for corrected documents
  const allDocIds = [...new Set(typedCorrections.map((c) => c.document_id))]
  const { data: docs } = await supabase
    .from("documents")
    .select("id, ocr_data")
    .in("id", allDocIds)

  const docSupplierMap = new Map<string, string>()
  if (docs) {
    for (const doc of docs) {
      const ocr = (doc.ocr_data ?? {}) as Record<string, unknown>
      const name = (ocr.supplier_name as string | null) ?? ""
      if (name) docSupplierMap.set(doc.id as string, name)
    }
  }

  const insights: CorrectionInsight[] = []
  for (const [category, data] of Array.from(categoryMap.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)) {

    // Find top suppliers for this category
    const supplierCounts = new Map<string, number>()
    for (const docId of data.docIds) {
      const supplier = docSupplierMap.get(docId)
      if (supplier) supplierCounts.set(supplier, (supplierCounts.get(supplier) ?? 0) + 1)
    }
    const topSuppliers = Array.from(supplierCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)

    // Determine accuracy trend (compare recent vs older corrections)
    const sortedDates = data.dates.sort((a, b) => b.getTime() - a.getTime())
    const midpoint = Math.floor(sortedDates.length / 2)
    const recentCount = midpoint > 0 ? midpoint : sortedDates.length
    const olderCount = sortedDates.length - recentCount

    let trend: "improving" | "stable" | "declining" = "stable"
    if (olderCount > 0 && recentCount > 0) {
      // Fewer recent corrections = improving (system is learning)
      const ratio = recentCount / olderCount
      if (ratio < 0.7) trend = "improving"
      else if (ratio > 1.3) trend = "declining"
    }

    insights.push({
      category,
      correctionCount: data.count,
      accuracyTrend: trend,
      topSuppliers,
    })
  }

  return insights
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

interface ValueCount {
  value: string
  confidence: number
}

/**
 * Extract meaningful keywords from text, filtering out common stop words.
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "shall",
    "should", "may", "might", "must", "can", "could", "of", "in", "to",
    "for", "with", "on", "at", "by", "from", "as", "or", "and", "not",
    "no", "but", "if", "than", "so", "very", "too", "also", "just",
    // Slovak stop words
    "a", "v", "na", "je", "sa", "s", "z", "do", "pre", "za", "po",
    "o", "so", "že", "ale", "aj", "to", "od", "pri", "ako", "ich",
  ])

  return text
    .split(/[\s,;:.!?/\\()\[\]{}"']+/)
    .filter((w) => w.length > 2 && !stopWords.has(w) && !/^\d+$/.test(w))
    .slice(0, 30)
}

/**
 * Find the best value using weighted voting across scored corrections.
 * Returns null if no corrections are provided.
 */
function findBestByWeightedVote(
  corrections: { newValue: string; score: number }[]
): ValueCount | null {
  if (corrections.length === 0) return null

  const weighted = new Map<string, { totalScore: number; count: number }>()
  for (const c of corrections) {
    const entry = weighted.get(c.newValue) ?? { totalScore: 0, count: 0 }
    entry.totalScore += c.score
    entry.count++
    weighted.set(c.newValue, entry)
  }

  let bestValue = ""
  let bestScore = 0
  let bestCount = 0
  for (const [val, data] of weighted) {
    if (data.totalScore > bestScore) {
      bestValue = val
      bestScore = data.totalScore
      bestCount = data.count
    }
  }

  if (!bestValue) return null

  // Confidence: normalize weighted score, boosted by repetition
  const rawConfidence = Math.min(bestScore / (WEIGHT_SUPPLIER + WEIGHT_AMOUNT + WEIGHT_TEXT + WEIGHT_TEMPORAL), 1.0)
  const repetitionBoost = bestCount >= 3 ? 0.15 : bestCount >= 2 ? 0.05 : 0
  const confidence = Math.min(rawConfidence + repetitionBoost, 0.95)

  // Require minimum confidence of 0.3
  if (confidence < 0.3) return null

  return { value: bestValue, confidence: Number(confidence.toFixed(2)) }
}
