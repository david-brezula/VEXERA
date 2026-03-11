import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "./org"
import { paginationRange, type PaginationParams, type PaginatedResult } from "./pagination"
import type { DocumentStatus, DocumentType } from "@vexera/types"

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocumentRow = {
  id: string
  name: string
  document_type: string | null
  file_path: string
  file_size_bytes: number | null
  mime_type: string | null
  invoice_id: string | null
  created_at: string
  ocr_status: string | null
  uploaded_by: string | null
  status: DocumentStatus
  supplier_name: string | null
  document_number: string | null
  issue_date: string | null
  due_date: string | null
  total_amount: number | null
  vat_amount: number | null
  vat_rate: number | null
  category: string | null
}

export type DocumentFilters = {
  document_type?: string
  invoice_id?: string
  search?: string
  status?: DocumentStatus | "all"
  date_from?: string
  date_to?: string
}

// ─── getDocuments ─────────────────────────────────────────────────────────────

export async function getDocuments(
  filters?: DocumentFilters,
  pagination?: PaginationParams
): Promise<PaginatedResult<DocumentRow>> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 }

  const { from, to, page, pageSize } = paginationRange(pagination)

  let query = supabase
    .from("documents")
    .select(
      "id, name, document_type, file_path, file_size_bytes, mime_type, invoice_id, ocr_status, created_at, uploaded_by, status, supplier_name, document_number, issue_date, due_date, total_amount, vat_amount, vat_rate, category",
      { count: "exact" }
    )
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to)

  if (filters?.document_type && filters.document_type !== "all") {
    query = query.eq("document_type", filters.document_type)
  }
  if (filters?.invoice_id) {
    query = query.eq("invoice_id", filters.invoice_id)
  }
  if (filters?.search) {
    query = query.or(
      `name.ilike.%${filters.search}%,supplier_name.ilike.%${filters.search}%,document_number.ilike.%${filters.search}%`
    )
  }
  if (filters?.status && filters.status !== "all") {
    query = query.eq("status", filters.status)
  }
  if (filters?.date_from) {
    query = query.gte("created_at", filters.date_from)
  }
  if (filters?.date_to) {
    query = query.lte("created_at", filters.date_to)
  }

  const { data, error, count } = await query
  if (error) throw error

  const total = count ?? 0
  return {
    data: (data ?? []) as unknown as DocumentRow[],
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

// ─── getDocument (single) ────────────────────────────────────────────────────

export type DocumentDetail = DocumentRow & {
  ocr_data: Record<string, unknown> | null
  organization_id: string
}

export async function getDocument(id: string): Promise<DocumentDetail | null> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return null

  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", id)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .single()

  if (error) return null
  return data as unknown as DocumentDetail | null
}

// ─── getDocumentComments ─────────────────────────────────────────────────────

export type DocumentComment = {
  id: string
  document_id: string
  user_id: string | null
  content: string
  created_at: string
}

export async function getDocumentComments(documentId: string): Promise<DocumentComment[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []

  const { data, error } = await supabase
    .from("document_comments")
    .select("id, document_id, user_id, content, created_at")
    .eq("document_id", documentId)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: true })

  if (error) return []
  return (data ?? []) as DocumentComment[]
}

// ─── getAuditLogsForDocument ─────────────────────────────────────────────────

export type AuditLogEntry = {
  id: string
  action: string
  user_id: string | null
  new_data: Record<string, unknown> | null
  old_data: Record<string, unknown> | null
  created_at: string
}

export async function getAuditLogsForDocument(documentId: string): Promise<AuditLogEntry[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []

  const { data, error } = await supabase
    .from("audit_logs")
    .select("id, action, user_id, new_data, old_data, created_at")
    .eq("entity_type", "document")
    .eq("entity_id", documentId)
    .eq("organization_id", orgId)
    .order("created_at", { ascending: false })
    .limit(5)

  if (error) return []
  return (data ?? []) as AuditLogEntry[]
}
