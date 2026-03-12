/**
 * Electronic Archive & Retention Service
 *
 * Manages document retention policies and archival per Slovak legal requirements.
 * Integrates with legislative service for default retention periods.
 *
 * Usage:
 *   await setRetentionPolicies(supabase, orgId)
 *   const expiring = await getExpiringDocuments(supabase, orgId, 30)
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Types ──────────────────────────────────────────────────────────────────

export interface ArchivePolicy {
  id: string
  organization_id: string
  document_type: string
  retention_years: number
  auto_archive: boolean
  notify_before_expiry_days: number
  created_at: string
  updated_at: string
}

export interface ExpiringDocument {
  id: string
  document_type: string
  supplier_name: string | null
  issue_date: string | null
  retention_expires_at: string
  days_until_expiry: number
}

// ─── Default retention periods (Slovak law) ─────────────────────────────────

const DEFAULT_RETENTION: Record<string, number> = {
  invoice_received: 10,
  invoice_issued: 10,
  receipt: 5,
  bank_statement: 10,
  tax_document: 10,
  payroll: 10,
  contract: 10,
  other: 5,
}

// ─── Policy Management ──────────────────────────────────────────────────────

/**
 * Initialize default retention policies for an org based on Slovak law.
 * Only creates policies that don't already exist.
 */
export async function setRetentionPolicies(
  supabase: SupabaseClient,
  organizationId: string
): Promise<number> {
  // Get existing policies
  const { data: existing } = await supabase
    .from("archive_policies")
    .select("document_type")
    .eq("organization_id", organizationId)

  const existingTypes = new Set(
    ((existing ?? []) as unknown as { document_type: string }[]).map((p) => p.document_type)
  )

  let created = 0
  for (const [docType, years] of Object.entries(DEFAULT_RETENTION)) {
    if (existingTypes.has(docType)) continue

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from("archive_policies" as any) as any)
      .insert({
        organization_id: organizationId,
        document_type: docType,
        retention_years: years,
        auto_archive: true,
        notify_before_expiry_days: 30,
      })

    if (!error) created++
  }

  return created
}

/**
 * Get all retention policies for an org.
 */
export async function getRetentionPolicies(
  supabase: SupabaseClient,
  organizationId: string
): Promise<ArchivePolicy[]> {
  const { data, error } = await supabase
    .from("archive_policies")
    .select("*")
    .eq("organization_id", organizationId)
    .order("document_type", { ascending: true })

  if (error) return []
  return (data ?? []) as unknown as ArchivePolicy[]
}

/**
 * Update a retention policy.
 */
export async function updateRetentionPolicy(
  supabase: SupabaseClient,
  organizationId: string,
  policyId: string,
  input: { retention_years?: number; auto_archive?: boolean; notify_before_expiry_days?: number }
): Promise<ArchivePolicy> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase.from("archive_policies" as any) as any)
    .update(input)
    .eq("id", policyId)
    .eq("organization_id", organizationId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to update policy: ${error?.message ?? "unknown error"}`)
  }

  return data as ArchivePolicy
}

// ─── Expiring Documents ─────────────────────────────────────────────────────

/**
 * Get documents approaching retention expiry within the next N days.
 */
export async function getExpiringDocuments(
  supabase: SupabaseClient,
  organizationId: string,
  daysAhead: number = 30
): Promise<ExpiringDocument[]> {
  // Get policies
  const policies = await getRetentionPolicies(supabase, organizationId)
  if (policies.length === 0) return []

  const policyMap = new Map(policies.map((p) => [p.document_type, p.retention_years]))

  // Fetch all documents with issue dates
  const { data: docs } = await supabase
    .from("documents")
    .select("id, document_type, supplier_name, issue_date")
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .not("issue_date", "is", null)

  if (!docs || docs.length === 0) return []

  const typedDocs = docs as unknown as {
    id: string
    document_type: string | null
    supplier_name: string | null
    issue_date: string
  }[]

  const now = new Date()
  const result: ExpiringDocument[] = []

  for (const doc of typedDocs) {
    const retentionYears = policyMap.get(doc.document_type ?? "other") ?? policyMap.get("other") ?? 5
    const issueDate = new Date(doc.issue_date)
    const expiresAt = new Date(issueDate)
    expiresAt.setFullYear(expiresAt.getFullYear() + retentionYears)

    const daysUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (daysUntilExpiry >= 0 && daysUntilExpiry <= daysAhead) {
      result.push({
        id: doc.id,
        document_type: doc.document_type ?? "other",
        supplier_name: doc.supplier_name,
        issue_date: doc.issue_date,
        retention_expires_at: expiresAt.toISOString().split("T")[0],
        days_until_expiry: daysUntilExpiry,
      })
    }
  }

  return result.sort((a, b) => a.days_until_expiry - b.days_until_expiry)
}

// ─── Archive Operations ─────────────────────────────────────────────────────

/**
 * Mark a document as archived.
 * In production this would also move S3 objects to IA (Infrequent Access) tier.
 */
export async function archiveDocument(
  supabase: SupabaseClient,
  organizationId: string,
  documentId: string
): Promise<void> {
  const { error } = await supabase
    .from("documents")
    .update({ status: "archived" })
    .eq("id", documentId)
    .eq("organization_id", organizationId)

  if (error) {
    throw new Error(`Failed to archive document: ${error.message}`)
  }

  // TODO: Move S3 object to IA tier via AWS SDK
  // await s3Client.send(new CopyObjectCommand({
  //   ...copyParams,
  //   StorageClass: "STANDARD_IA"
  // }))
}

/**
 * Process retention expiry — archive or notify about expiring documents.
 * Designed to be called as a queue job.
 */
export async function processRetentionExpiry(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ archived: number; notified: number }> {
  const policies = await getRetentionPolicies(supabase, organizationId)
  const autoArchiveTypes = new Set(
    policies.filter((p) => p.auto_archive).map((p) => p.document_type)
  )

  // Get documents expiring within notification window
  const maxNotifyDays = Math.max(...policies.map((p) => p.notify_before_expiry_days), 30)
  const expiring = await getExpiringDocuments(supabase, organizationId, maxNotifyDays)

  let archived = 0
  let notified = 0

  for (const doc of expiring) {
    if (doc.days_until_expiry <= 0 && autoArchiveTypes.has(doc.document_type)) {
      // Auto-archive expired documents
      try {
        await archiveDocument(supabase, organizationId, doc.id)
        archived++
      } catch {
        // Non-fatal
      }
    } else {
      // Will be handled by notification system
      notified++
    }
  }

  return { archived, notified }
}
