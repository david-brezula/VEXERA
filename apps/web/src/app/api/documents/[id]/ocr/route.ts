/**
 * POST /api/documents/[id]/ocr — trigger OCR processing for a single document
 *
 * Validates document exists and belongs to the user's organization,
 * then runs OCR processing asynchronously.
 *
 * Returns 202 Accepted with job status.
 */

import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { processDocument } from "@/lib/services/ocr.service"

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const { id: documentId } = await params

    if (!documentId) {
      return NextResponse.json({ error: "Document ID is required" }, { status: 400 })
    }

    // Get the user's active organization from the document itself
    // First, find the document and verify membership
    const { data: doc, error: docError } = await supabase
      .from("documents")
      .select("id, organization_id, ocr_status, name")
      .eq("id", documentId)
      .is("deleted_at", null)
      .single()

    if (docError || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const document = doc as unknown as {
      id: string
      organization_id: string
      ocr_status: string
      name: string
    }

    // Verify user is a member of the document's organization
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", document.organization_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Check if already processing or done
    if (document.ocr_status === "processing") {
      return NextResponse.json(
        { error: "Document is already being processed" },
        { status: 409 }
      )
    }

    // Process OCR
    const result = await processDocument(supabase, document.organization_id, documentId)

    if (result.success) {
      return NextResponse.json(
        {
          job_id: documentId,
          document_id: documentId,
          status: "done",
          message: "OCR processing completed successfully",
        },
        { status: 202 }
      )
    } else {
      return NextResponse.json(
        {
          job_id: documentId,
          document_id: documentId,
          status: "failed",
          error: result.error,
        },
        { status: 202 }
      )
    }
  } catch (err) {
    console.error("POST /api/documents/[id]/ocr error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
