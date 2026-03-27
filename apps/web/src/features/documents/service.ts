/**
 * Document Service
 *
 * Handles document lifecycle: upload to S3, DB record creation,
 * soft-delete, metadata updates, and OCR status management.
 *
 * All operations enforce organization_id scoping at the service layer.
 * Supabase RLS is the last line of defense — this layer is first.
 *
 * Usage (from API routes or Server Actions):
 *   const supabase = await createClient()
 *   const { id } = await createDocument(supabase, { organizationId, ... })
 */

import { PutObjectCommand } from "@aws-sdk/client-s3"
import { getS3Client, getS3BucketName, generateS3Key } from "@/lib/s3/client"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { DocumentType, OcrStatus } from "@vexera/types"

// ─── Input / Output types ─────────────────────────────────────────────────────

export interface CreateDocumentInput {
  organizationId: string
  uploadedBy: string
  file: File | Buffer
  fileName: string
  mimeType: string
  fileSize: number
  documentType?: DocumentType
  invoiceId?: string
}

export interface DocumentRecord {
  id: string
  organization_id: string
  name: string
  file_path: string
  file_size_bytes: number | null
  mime_type: string | null
  document_type: string | null
  invoice_id: string | null
  ocr_status: OcrStatus
  ocr_data: Record<string, unknown> | null
  ocr_processed_at: string | null
  uploaded_by: string | null
  deleted_at: string | null
  created_at: string
  updated_at: string
}

export interface ListDocumentsFilters {
  documentType?: string
  invoiceId?: string
  search?: string
  limit?: number
  offset?: number
}

// ─── createDocument ───────────────────────────────────────────────────────────

/**
 * Upload a file to S3 and insert a document record in the DB.
 * Sets ocr_status = 'queued'. The caller is responsible for triggering OCR.
 * Returns the new document ID (used as job_id for OCR).
 */
export async function createDocument(
  supabase: SupabaseClient,
  input: CreateDocumentInput
): Promise<{ id: string; filePath: string }> {
  const s3 = getS3Client()
  const bucket = getS3BucketName()
  const filePath = generateS3Key(input.organizationId, input.fileName)

  // Upload to S3 first — if this fails, no DB record is created
  const body =
    input.file instanceof File
      ? Buffer.from(await input.file.arrayBuffer())
      : input.file

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: filePath,
      Body: body,
      ContentType: input.mimeType,
      ContentLength: input.fileSize,
    })
  )

  // Create the DB record
  const { data, error } = await supabase
    .from("documents")
    .insert({
      organization_id: input.organizationId,
      name: input.fileName,
      file_path: filePath,
      file_size_bytes: input.fileSize,
      mime_type: input.mimeType,
      document_type: input.documentType ?? null,
      invoice_id: input.invoiceId ?? null,
      uploaded_by: input.uploadedBy,
      ocr_status: "queued",
    })
    .select("id")
    .single()

  if (error || !data) {
    throw new Error(`Failed to create document record: ${error?.message ?? "unknown error"}`)
  }

  return { id: (data as { id: string }).id, filePath }
}

// ─── getDocument ──────────────────────────────────────────────────────────────

/**
 * Fetch a single document, scoped to the given organization.
 * Returns null if not found or soft-deleted.
 */
export async function getDocument(
  supabase: SupabaseClient,
  organizationId: string,
  documentId: string
): Promise<DocumentRecord | null> {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .single()

  if (error || !data) return null
  return data as unknown as DocumentRecord
}

// ─── listDocuments ────────────────────────────────────────────────────────────

/**
 * List documents for an organization with optional filters.
 */
export async function listDocuments(
  supabase: SupabaseClient,
  organizationId: string,
  filters: ListDocumentsFilters = {}
): Promise<DocumentRecord[]> {
  const limit = filters.limit ?? 50
  const offset = filters.offset ?? 0

  let query = supabase
    .from("documents")
    .select(
      "id, organization_id, name, document_type, file_path, file_size_bytes, mime_type, invoice_id, ocr_status, ocr_data, ocr_processed_at, uploaded_by, deleted_at, created_at, updated_at"
    )
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (filters.documentType) {
    query = query.eq("document_type", filters.documentType)
  }
  if (filters.invoiceId) {
    query = query.eq("invoice_id", filters.invoiceId)
  }
  if (filters.search) {
    query = query.ilike("name", `%${filters.search}%`)
  }

  const { data, error } = await query
  if (error) throw new Error(`Failed to list documents: ${error.message}`)
  return (data ?? []) as unknown as DocumentRecord[]
}

// ─── updateDocument ───────────────────────────────────────────────────────────

/**
 * Update document metadata. Only updates non-null patch fields.
 * Cannot change file_path — that is immutable after upload.
 */
export async function updateDocument(
  supabase: SupabaseClient,
  organizationId: string,
  documentId: string,
  patch: Partial<{
    name: string
    document_type: DocumentType
    invoice_id: string | null
  }>
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("documents")
    .update(patch)
    .eq("id", documentId)
    .eq("organization_id", organizationId)
    .is("deleted_at", null)

  return error ? { error: error.message } : {}
}

// ─── deleteDocument ───────────────────────────────────────────────────────────

/**
 * Soft-delete a document. The S3 object is retained for audit purposes.
 * Hard deletion requires a separate cleanup job.
 */
export async function deleteDocument(
  supabase: SupabaseClient,
  organizationId: string,
  documentId: string
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("documents")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", documentId)
    .eq("organization_id", organizationId)

  return error ? { error: error.message } : {}
}
