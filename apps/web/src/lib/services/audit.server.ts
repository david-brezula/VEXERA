/**
 * Audit Log Service — Server-side
 *
 * Use this from Server Actions and API routes where you already have
 * a Supabase server client. Writes directly to audit_logs table.
 *
 * For client-side audit logging use the write-audit-log Edge Function instead.
 *
 * Usage:
 *   await writeAuditLog(supabase, {
 *     organizationId,
 *     userId: user.id,
 *     action: "INVOICE_CREATED",
 *     entityType: "invoice",
 *     entityId: invoice.id,
 *     newData: { invoice_number, total },
 *   })
 *
 * Non-fatal: errors are logged to console but never thrown,
 * so an audit failure never blocks the main operation.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export type AuditAction =
  // Invoices
  | "INVOICE_CREATED"
  | "INVOICE_UPDATED"
  | "INVOICE_STATUS_CHANGED"
  | "INVOICE_DELETED"
  | "INVOICE_PRINTED"
  // Documents
  | "DOCUMENT_UPLOADED"
  | "DOCUMENT_DELETED"
  | "DOCUMENT_LINKED_TO_INVOICE"
  | "DOCUMENT_OCR_COMPLETED"
  | "DOCUMENT_OCR_FAILED"
  // Bank
  | "BANK_STATEMENT_IMPORTED"
  | "BANK_TRANSACTION_MATCHED"
  | "BANK_TRANSACTION_UNMATCHED"
  // Rules
  | "RULE_CREATED"
  | "RULE_UPDATED"
  | "RULE_DELETED"
  | "RULE_APPLIED"
  // Export
  | "EXPORT_REQUESTED"
  | "EXPORT_COMPLETED"
  | "EXPORT_FAILED"
  // Auth & Org
  | "USER_INVITED"
  | "USER_JOINED"
  | "ORG_SETTINGS_UPDATED"
  // System
  | "INVOICE_STATUS_CHANGED"  // also used by Edge Function

export type AuditEntityType =
  | "invoice"
  | "document"
  | "bank_account"
  | "bank_transaction"
  | "rule"
  | "export_job"
  | "organization"
  | "user"

export interface WriteAuditLogParams {
  organizationId: string
  userId: string | null
  action: AuditAction | string   // string allows custom actions from Edge Functions
  entityType: AuditEntityType | string
  entityId?: string
  oldData?: Record<string, unknown>
  newData?: Record<string, unknown>
  metadata?: Record<string, unknown>
}

export async function writeAuditLog(
  supabase: SupabaseClient,
  params: WriteAuditLogParams
): Promise<void> {
  try {
    const { error } = await supabase.from("audit_logs").insert({
      organization_id: params.organizationId,
      user_id: params.userId,
      action: params.action,
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      old_data: params.oldData ?? null,
      new_data: params.newData ?? null,
      metadata: params.metadata ?? null,
    })

    if (error) {
      console.error("[audit] Failed to write audit log:", error.message, {
        action: params.action,
        entityType: params.entityType,
        entityId: params.entityId,
      })
    }
  } catch (err) {
    // Never throw — audit failures must not break the caller
    console.error("[audit] Unexpected error writing audit log:", err)
  }
}
