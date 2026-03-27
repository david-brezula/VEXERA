"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/features/settings/data-org"
import { writeAuditLog } from "@/shared/services/audit.server"
import type { DocumentStatus } from "@vexera/types"

// ─── Allowed status transitions ──────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<DocumentStatus, DocumentStatus[]> = {
  new: ["auto_processed", "awaiting_review"],
  auto_processed: ["awaiting_review"],
  awaiting_review: ["approved", "awaiting_client"],
  approved: ["archived"],
  awaiting_client: ["awaiting_review", "archived"],
  archived: [],
}

// ─── deleteDocumentAction ─────────────────────────────────────────────────────

export async function deleteDocumentAction(
  documentId: string
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const { error } = await supabase
      .from("documents")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", documentId)
      .eq("organization_id", orgId)

    if (error) return { error: error.message }

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "DOCUMENT_DELETED",
      entityType: "document",
      entityId: documentId,
    })

    revalidatePath("/documents")
    revalidatePath("/")
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── linkDocumentToInvoiceAction ──────────────────────────────────────────────

export async function linkDocumentToInvoiceAction(
  documentId: string,
  invoiceId: string | null
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const { error } = await supabase
      .from("documents")
      .update({ invoice_id: invoiceId })
      .eq("id", documentId)
      .eq("organization_id", orgId)

    if (error) return { error: error.message }

    const { data: { user } } = await supabase.auth.getUser()
    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user?.id ?? null,
      action: "DOCUMENT_LINKED_TO_INVOICE",
      entityType: "document",
      entityId: documentId,
      newData: { invoice_id: invoiceId },
    })

    revalidatePath("/documents")
    if (invoiceId) revalidatePath(`/invoices/${invoiceId}`)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── updateDocumentStatusAction ───────────────────────────────────────────────

export async function updateDocumentStatusAction(
  documentId: string,
  newStatus: DocumentStatus
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    // Fetch current status
    const { data: doc, error: fetchError } = await supabase
      .from("documents")
      .select("status")
      .eq("id", documentId)
      .eq("organization_id", orgId)
      .single()

    if (fetchError || !doc) return { error: "Document not found" }

    const currentStatus = doc.status as DocumentStatus
    const allowed = ALLOWED_TRANSITIONS[currentStatus] ?? []
    if (!allowed.includes(newStatus)) {
      return { error: `Cannot transition from "${currentStatus}" to "${newStatus}"` }
    }

    const { error } = await supabase
      .from("documents")
      .update({ status: newStatus })
      .eq("id", documentId)
      .eq("organization_id", orgId)

    if (error) return { error: error.message }

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "DOCUMENT_STATUS_CHANGED",
      entityType: "document",
      entityId: documentId,
      oldData: { status: currentStatus },
      newData: { status: newStatus },
    })

    revalidatePath("/documents")
    revalidatePath(`/documents/${documentId}`)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── batchApproveDocumentsAction ──────────────────────────────────────────────

export async function batchApproveDocumentsAction(
  documentIds: string[]
): Promise<{ error?: string; approvedCount?: number }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    // Only approve documents in awaiting_review or auto_processed status
    const { data: docsRaw, error: fetchError } = await supabase
      .from("documents")
      .select("id, status")
      .eq("organization_id", orgId)
      .in("id", documentIds)
      .in("status", ["awaiting_review", "auto_processed"])

    if (fetchError) return { error: fetchError.message }
    if (!docsRaw || docsRaw.length === 0) return { error: "No eligible documents to approve" }

    const docs = docsRaw as Array<{ id: string; status: DocumentStatus }>
    const eligibleIds = docs.map((d) => d.id)

    const { error } = await supabase
      .from("documents")
      .update({ status: "approved" })
      .in("id", eligibleIds)
      .eq("organization_id", orgId)

    if (error) return { error: error.message }

    // Audit each
    for (const doc of docs) {
      await writeAuditLog(supabase, {
        organizationId: orgId,
        userId: user.id,
        action: "DOCUMENT_STATUS_CHANGED",
        entityType: "document",
        entityId: doc.id,
        oldData: { status: doc.status },
        newData: { status: "approved" },
      })
    }

    revalidatePath("/documents")
    return { approvedCount: eligibleIds.length }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── updateDocumentMetadataAction ─────────────────────────────────────────────

export async function updateDocumentMetadataAction(
  documentId: string,
  data: {
    supplier_name?: string | null
    document_number?: string | null
    issue_date?: string | null
    due_date?: string | null
    total_amount?: number | null
    vat_amount?: number | null
    vat_rate?: number | null
    category?: string | null
  }
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const { error } = await supabase
      .from("documents")
      .update(data)
      .eq("id", documentId)
      .eq("organization_id", orgId)

    if (error) return { error: error.message }

    await writeAuditLog(supabase, {
      organizationId: orgId,
      userId: user.id,
      action: "DOCUMENT_METADATA_UPDATED",
      entityType: "document",
      entityId: documentId,
      newData: data,
    })

    revalidatePath(`/documents/${documentId}`)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}

// ─── addDocumentCommentAction ─────────────────────────────────────────────────

export async function addDocumentCommentAction(
  documentId: string,
  content: string
): Promise<{ error?: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return { error: "Not authenticated" }

    const { error } = await supabase.from("document_comments")
      .insert({
        document_id: documentId,
        organization_id: orgId,
        user_id: user.id,
        content,
      })

    if (error) return { error: error.message }

    revalidatePath(`/documents/${documentId}`)
    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}
