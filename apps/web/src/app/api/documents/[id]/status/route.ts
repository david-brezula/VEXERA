/**
 * PATCH /api/documents/[id]/status — transition document status
 *
 * Body: { status: DocumentStatus }
 *
 * Validates the transition is legal per the state machine:
 *   new            -> auto_processed, awaiting_review
 *   auto_processed -> awaiting_review, approved
 *   awaiting_review -> approved, awaiting_client
 *   approved       -> archived
 *   awaiting_client -> awaiting_review, approved
 *
 * Returns 400 for invalid transitions.
 * Records audit log entry on every successful transition.
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/services/audit.server"
import type { DocumentStatus } from "@vexera/types"

// ─── State machine ─────────────────────────────────────────────────────────────

const VALID_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  new: ["auto_processed", "awaiting_review"],
  auto_processed: ["awaiting_review", "approved"],
  awaiting_review: ["approved", "awaiting_client"],
  approved: ["archived"],
  awaiting_client: ["awaiting_review", "approved"],
  archived: [],
}

const StatusSchema = z.object({
  status: z.enum([
    "new",
    "auto_processed",
    "awaiting_review",
    "approved",
    "awaiting_client",
    "archived",
  ]),
})

// ─── PATCH ──────────────────────────────────────────────────────────────────────

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: documentId } = await params
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Parse + validate body
    const body = await request.json()
    const parsed = StatusSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const targetStatus = parsed.data.status

    // Fetch the document (org-scoped via RLS + explicit filter)
    const { data: doc, error: fetchErr } = await supabase
      .from("documents")
      .select("id, organization_id, status, name")
      .eq("id", documentId)
      .is("deleted_at", null)
      .single()

    if (fetchErr || !doc) {
      return NextResponse.json({ error: "Document not found" }, { status: 404 })
    }

    const document = doc as unknown as {
      id: string
      organization_id: string
      status: DocumentStatus
      name: string
    }

    // Verify membership in the org
    const { data: membership } = await supabase
      .from("organization_members")
      .select("id")
      .eq("organization_id", document.organization_id)
      .eq("user_id", user.id)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    // Validate the transition
    const currentStatus = document.status ?? "new"
    const allowed = VALID_TRANSITIONS[currentStatus] ?? []

    if (!allowed.includes(targetStatus)) {
      return NextResponse.json(
        {
          error: `Invalid status transition: ${currentStatus} -> ${targetStatus}`,
          allowed_transitions: allowed,
        },
        { status: 400 }
      )
    }

    // Perform the update
    const { error: updateErr } = await supabase
      .from("documents")
      .update({ status: targetStatus })
      .eq("id", documentId)
      .eq("organization_id", document.organization_id)

    if (updateErr) {
      return NextResponse.json(
        { error: `Failed to update status: ${updateErr.message}` },
        { status: 500 }
      )
    }

    // Audit log — non-fatal
    await writeAuditLog(supabase, {
      organizationId: document.organization_id,
      userId: user.id,
      action: "DOCUMENT_STATUS_CHANGED",
      entityType: "document",
      entityId: documentId,
      oldData: { status: currentStatus },
      newData: { status: targetStatus },
      metadata: { document_name: document.name },
    })

    return NextResponse.json({
      id: documentId,
      previous_status: currentStatus,
      status: targetStatus,
    })
  } catch (err) {
    console.error("PATCH /api/documents/[id]/status error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
