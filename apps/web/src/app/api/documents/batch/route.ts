/**
 * POST /api/documents/batch — batch approve / reject / archive documents
 *
 * Body:
 *   {
 *     document_ids: string[],
 *     action: 'approve' | 'reject' | 'archive'
 *   }
 *
 * Action mapping:
 *   approve -> status 'approved'
 *   reject  -> status 'awaiting_client'
 *   archive -> status 'archived'
 *
 * Validates all documents belong to the user's org.
 * Updates all valid documents in a single query.
 * Records an audit log entry for each document.
 *
 * Returns { updated: number, failed: number }
 */

import { NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { writeAuditLog } from "@/lib/services/audit.server"
import type { DocumentStatus } from "@vexera/types"

const ACTION_TO_STATUS: Record<string, DocumentStatus> = {
  approve: "approved",
  reject: "awaiting_client",
  archive: "archived",
}

const BatchSchema = z.object({
  document_ids: z
    .array(z.string().uuid())
    .min(1, "At least one document_id is required")
    .max(100, "Maximum 100 documents per batch"),
  action: z.enum(["approve", "reject", "archive"]),
})

// ─── POST ─────────────────────────────────────────────────────────────────────

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    // Parse + validate body
    const body = await request.json()
    const parsed = BatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid body", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }

    const { document_ids, action } = parsed.data
    const targetStatus = ACTION_TO_STATUS[action]

    // Get the user's organization memberships to determine which org they belong to
    const { data: memberships } = await supabase
      .from("organization_members")
      .select("organization_id")
      .eq("user_id", user.id)

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const orgIds = (memberships as Array<{ organization_id: string }>).map(
      (m) => m.organization_id
    )

    // Fetch all requested documents to validate they belong to the user's orgs
    const { data: docs, error: fetchErr } = await supabase
      .from("documents")
      .select("id, organization_id, status, name")
      .in("id", document_ids)
      .is("deleted_at", null)

    if (fetchErr) {
      return NextResponse.json(
        { error: `Failed to fetch documents: ${fetchErr.message}` },
        { status: 500 }
      )
    }

    const documents = (docs ?? []) as unknown as Array<{
      id: string
      organization_id: string
      status: DocumentStatus
      name: string
    }>

    // Filter to only documents that belong to the user's orgs
    const validDocs = documents.filter((d) => orgIds.includes(d.organization_id))
    const failed = document_ids.length - validDocs.length

    if (validDocs.length === 0) {
      return NextResponse.json(
        { error: "No valid documents found for this operation", updated: 0, failed },
        { status: 400 }
      )
    }

    // Extract IDs of valid documents
    const validIds = validDocs.map((d) => d.id)

    // Perform the batch update
    const { error: updateErr, count } = await supabase
      .from("documents")
      .update({ status: targetStatus })
      .in("id", validIds)
      .is("deleted_at", null)

    if (updateErr) {
      return NextResponse.json(
        { error: `Batch update failed: ${updateErr.message}` },
        { status: 500 }
      )
    }

    // Write audit logs for each document — non-fatal, fire-and-forget
    for (const doc of validDocs) {
      writeAuditLog(supabase, {
        organizationId: doc.organization_id,
        userId: user.id,
        action: "DOCUMENT_STATUS_CHANGED",
        entityType: "document",
        entityId: doc.id,
        oldData: { status: doc.status },
        newData: { status: targetStatus },
        metadata: { batch_action: action, document_name: doc.name },
      }).catch((err) => console.error("[batch] audit log error:", err))
    }

    return NextResponse.json({
      updated: count ?? validDocs.length,
      failed,
      target_status: targetStatus,
    })
  } catch (err) {
    console.error("POST /api/documents/batch error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    )
  }
}
