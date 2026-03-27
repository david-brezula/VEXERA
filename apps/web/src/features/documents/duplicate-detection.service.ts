/**
 * Duplicate Detection Service
 *
 * Detects duplicate documents within an organization using three strategies:
 *   1. Exact match  — identical file hash (SHA-256)            → score 1.0
 *   2. Fuzzy match  — same supplier + amount + date (±3 days)  → score 0.9
 *   3. Partial match — same supplier + amount (different date)  → score 0.6
 *
 * All queries enforce organization_id scoping at the service layer.
 *
 * Usage:
 *   const supabase = await createClient()
 *   const dupes = await findDuplicates(supabase, orgId, documentId)
 */

import { createHash } from "crypto"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { DuplicateCandidate } from "@vexera/types"

// ─── computeFileHash ─────────────────────────────────────────────────────────

/**
 * Compute a SHA-256 hex digest for a raw file buffer.
 * Used to populate `file_hash` on upload and for pre-upload duplicate checks.
 */
export function computeFileHash(buffer: Buffer): string {
  return createHash("sha256").update(buffer).digest("hex")
}

// ─── findDuplicates ──────────────────────────────────────────────────────────

/**
 * Find potential duplicate documents for a given document within the same org.
 *
 * Strategy:
 *   1. Fetch the source document's metadata (hash, supplier, amount, date).
 *   2. Query all other documents in the same org that are not soft-deleted.
 *   3. Score each candidate against the three match tiers.
 *
 * Returns candidates sorted by match_score DESC.
 */
export async function findDuplicates(
  supabase: SupabaseClient,
  organizationId: string,
  documentId: string
): Promise<DuplicateCandidate[]> {
  // 1. Fetch source document
  const { data: source, error: srcErr } = await supabase
    .from("documents")
    .select("id, file_hash, ocr_data, created_at")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .single()

  if (srcErr || !source) return []

  const srcOcr = (source.ocr_data ?? {}) as Record<string, unknown>
  const srcHash = source.file_hash as string | null
  const srcSupplier = normalise(srcOcr.supplier_name as string | null)
  const srcAmount = srcOcr.total_amount as number | null
  const srcDate = srcOcr.issue_date as string | null

  // 2. Fetch candidate documents in the same org (exclude the source doc)
  const { data: candidates, error: candErr } = await supabase
    .from("documents")
    .select("id, name, file_hash, ocr_data, created_at")
    .eq("organization_id", organizationId)
    .neq("id", documentId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .limit(500)

  if (candErr || !candidates) return []

  // 3. Score each candidate
  const results: DuplicateCandidate[] = []

  for (const cand of candidates) {
    const candOcr = (cand.ocr_data ?? {}) as Record<string, unknown>
    const candHash = cand.file_hash as string | null
    const candSupplier = normalise(candOcr.supplier_name as string | null)
    const candAmount = candOcr.total_amount as number | null
    const candDate = candOcr.issue_date as string | null

    // Tier 1: Exact hash match
    if (srcHash && candHash && srcHash === candHash) {
      results.push({
        document_id: cand.id as string,
        document_name: cand.name as string,
        match_score: 1.0,
        match_reason: "Same file hash",
        created_at: cand.created_at as string,
      })
      continue
    }

    // Tier 2: Fuzzy — same supplier + same amount + date within 3 days
    if (
      srcSupplier &&
      candSupplier &&
      srcSupplier === candSupplier &&
      srcAmount != null &&
      candAmount != null &&
      srcAmount === candAmount &&
      srcDate &&
      candDate &&
      daysApart(srcDate, candDate) <= 3
    ) {
      results.push({
        document_id: cand.id as string,
        document_name: cand.name as string,
        match_score: 0.9,
        match_reason: "Same supplier + amount + date (within 3 days)",
        created_at: cand.created_at as string,
      })
      continue
    }

    // Tier 3: Partial — same supplier + same amount (different date)
    if (
      srcSupplier &&
      candSupplier &&
      srcSupplier === candSupplier &&
      srcAmount != null &&
      candAmount != null &&
      srcAmount === candAmount
    ) {
      results.push({
        document_id: cand.id as string,
        document_name: cand.name as string,
        match_score: 0.6,
        match_reason: "Same supplier + amount (different date)",
        created_at: cand.created_at as string,
      })
    }
  }

  // Sort by match_score DESC
  results.sort((a, b) => b.match_score - a.match_score)

  return results
}

// ─── checkBeforeUpload ───────────────────────────────────────────────────────

/**
 * Quick pre-upload check: does a document with the same SHA-256 hash
 * already exist in this organization?
 */
export async function checkBeforeUpload(
  supabase: SupabaseClient,
  organizationId: string,
  fileHash: string
): Promise<DuplicateCandidate[]> {
  const { data, error } = await supabase
    .from("documents")
    .select("id, name, created_at")
    .eq("organization_id", organizationId)
    .eq("file_hash", fileHash)
    .is("deleted_at", null)
    .limit(20)

  if (error || !data) return []

  return data.map((doc) => ({
    document_id: doc.id as string,
    document_name: doc.name as string,
    match_score: 1.0,
    match_reason: "Same file hash",
    created_at: doc.created_at as string,
  }))
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Normalise a string for fuzzy comparison: lowercase + trim whitespace */
function normalise(value: string | null | undefined): string | null {
  if (!value) return null
  return value.trim().toLowerCase()
}

/** Returns the absolute number of days between two ISO date strings. */
function daysApart(a: string, b: string): number {
  const msPerDay = 86_400_000
  const da = new Date(a).getTime()
  const db = new Date(b).getTime()
  return Math.abs(da - db) / msPerDay
}
