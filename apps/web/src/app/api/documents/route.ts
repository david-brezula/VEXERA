/**
 * GET  /api/documents  — list documents for an organization
 * POST /api/documents  — upload a document file, enqueue OCR
 *
 * GET query params:
 *   organization_id  — required
 *   document_type    — optional filter
 *   invoice_id       — optional filter
 *   search           — optional name search
 *   limit            — default 50
 *   offset           — default 0
 *
 * POST accepts multipart/form-data:
 *   file             — the file (PDF, JPEG, PNG, WebP, TIFF, max 50 MB)
 *   organization_id  — required UUID
 *   document_type    — optional: invoice_issued | invoice_received | receipt | contract | bank_statement | tax_document | other
 *   invoice_id       — optional UUID to link the document to an invoice
 *
 * POST returns 202 Accepted:
 *   {
 *     job_id:      string,   // same as document_id — pass to process-ocr Edge Function
 *     document_id: string,
 *     status:      "queued"
 *   }
 *
 * After upload, trigger OCR by calling the process-ocr Edge Function:
 *   POST /functions/v1/process-ocr  { document_id, organization_id }
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createDocument, listDocuments } from "@/features/documents/service"
import { writeAuditLog } from "@/shared/services/audit.server"

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
])

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

const DocumentTypeSchema = z.enum([
  "invoice_issued",
  "invoice_received",
  "receipt",
  "contract",
  "bank_statement",
  "tax_document",
  "other",
])

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const url = new URL(request.url)
    const organizationId = url.searchParams.get("organization_id")
    if (!organizationId) {
      return NextResponse.json({ error: "organization_id is required" }, { status: 400 })
    }

    // Service-layer org guard (RLS is additional protection)
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const documents = await listDocuments(supabase, organizationId, {
      documentType: url.searchParams.get("document_type") ?? undefined,
      invoiceId: url.searchParams.get("invoice_id") ?? undefined,
      search: url.searchParams.get("search") ?? undefined,
      limit: parseInt(url.searchParams.get("limit") ?? "50"),
      offset: parseInt(url.searchParams.get("offset") ?? "0"),
    })

    return NextResponse.json({ data: documents, count: documents.length })
  } catch (err) {
    console.error("GET /api/documents error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const formData = await request.formData()
    const file = formData.get("file") as File | null
    const organizationId = formData.get("organization_id") as string | null
    const rawDocumentType = formData.get("document_type") as string | null
    const invoiceId = formData.get("invoice_id") as string | null

    // Required fields
    if (!file || !organizationId) {
      return NextResponse.json(
        { error: "file and organization_id are required" },
        { status: 400 }
      )
    }

    // File type validation
    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      return NextResponse.json(
        { error: `Unsupported file type: ${file.type}. Allowed: PDF, JPEG, PNG, WebP, TIFF` },
        { status: 422 }
      )
    }

    // File size validation
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "File exceeds 50 MB limit" }, { status: 422 })
    }

    // document_type validation (optional)
    let documentType: z.infer<typeof DocumentTypeSchema> | undefined
    if (rawDocumentType) {
      const parsed = DocumentTypeSchema.safeParse(rawDocumentType)
      if (!parsed.success) {
        return NextResponse.json({ error: "Invalid document_type" }, { status: 400 })
      }
      documentType = parsed.data
    }

    // Service-layer org guard
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Upload to S3 + create DB record (ocr_status = 'queued')
    const { id: documentId, filePath } = await createDocument(supabase, {
      organizationId,
      uploadedBy: user.id,
      file,
      fileName: file.name,
      mimeType: file.type,
      fileSize: file.size,
      documentType,
      invoiceId: invoiceId ?? undefined,
    })

    // Audit log — non-fatal
    await writeAuditLog(supabase, {
      organizationId,
      userId: user.id,
      action: "DOCUMENT_UPLOADED",
      entityType: "document",
      entityId: documentId,
      newData: {
        name: file.name,
        document_type: documentType ?? null,
        file_size_bytes: file.size,
        file_path: filePath,
        mime_type: file.type,
      },
    })

    return NextResponse.json(
      {
        job_id: documentId,
        document_id: documentId,
        status: "queued",
        message:
          "Document uploaded and OCR queued. Trigger processing: POST /functions/v1/process-ocr with { document_id, organization_id }",
      },
      { status: 202 }
    )
  } catch (err) {
    console.error("POST /api/documents error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 500 }
    )
  }
}
