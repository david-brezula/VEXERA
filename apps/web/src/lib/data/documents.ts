import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "./org"

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
}

export type DocumentFilters = {
  document_type?: string
  invoice_id?: string
  search?: string
}

// ─── getDocuments ─────────────────────────────────────────────────────────────

export async function getDocuments(filters?: DocumentFilters): Promise<DocumentRow[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []

  let query = supabase
    .from("documents")
    .select(
      "id, name, document_type, file_path, file_size_bytes, mime_type, invoice_id, ocr_status, created_at, uploaded_by"
    )
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  if (filters?.document_type) {
    query = query.eq("document_type", filters.document_type)
  }
  if (filters?.invoice_id) {
    query = query.eq("invoice_id", filters.invoice_id)
  }
  if (filters?.search) {
    query = query.ilike("name", `%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw error
  return (data ?? []) as DocumentRow[]
}
