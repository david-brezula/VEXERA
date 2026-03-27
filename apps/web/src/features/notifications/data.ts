import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"
import type { DocumentStatus } from "@vexera/types"

export type InboxDocument = {
  id: string
  name: string
  document_type: string | null
  status: DocumentStatus
  supplier_name: string | null
  document_number: string | null
  total_amount: number | null
  created_at: string
  ocr_status: string | null
}

export type InboxStats = {
  newCount: number
  autoProcessedCount: number
  awaitingReviewCount: number
  approvedTodayCount: number
}

export async function getInboxDocuments(): Promise<InboxDocument[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []

  const { data, error } = await supabase
    .from("documents")
    .select("id, name, document_type, status, supplier_name, document_number, total_amount, created_at, ocr_status")
    .eq("organization_id", orgId)
    .in("status", ["new", "auto_processed", "awaiting_review"])
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (error) throw error
  return (data ?? []) as unknown as InboxDocument[]
}

export async function getInboxStats(): Promise<InboxStats> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { newCount: 0, autoProcessedCount: 0, awaitingReviewCount: 0, approvedTodayCount: 0 }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const [docsResult, approvedResult] = await Promise.all([
    supabase
      .from("documents")
      .select("status")
      .eq("organization_id", orgId)
      .in("status", ["new", "auto_processed", "awaiting_review"])
      .is("deleted_at", null),
    supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("status", "approved")
      .gte("updated_at", today.toISOString())
      .is("deleted_at", null),
  ])

  const docs = (docsResult.data ?? []) as unknown as Array<{ status: string }>
  return {
    newCount: docs.filter(d => d.status === "new").length,
    autoProcessedCount: docs.filter(d => d.status === "auto_processed").length,
    awaitingReviewCount: docs.filter(d => d.status === "awaiting_review").length,
    approvedTodayCount: approvedResult.count ?? 0,
  }
}
