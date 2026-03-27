/**
 * "What Accountant Needs" data layer
 *
 * Queries for missing docs, unanswered questions, incomplete invoices.
 * Used by the entrepreneur dashboard widget.
 *
 * Usage:
 *   const needs = await getAccountantNeeds(supabase, orgId)
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export interface AccountantNeed {
  type: "missing_document" | "incomplete_invoice" | "pending_approval" | "unmatched_transaction"
  title: string
  description: string
  count: number
  severity: "high" | "medium" | "low"
  actionUrl?: string
}

export interface AccountantNeedsSummary {
  needs: AccountantNeed[]
  totalIssues: number
  urgentCount: number
}

export async function getAccountantNeeds(
  supabase: SupabaseClient,
  organizationId: string
): Promise<AccountantNeedsSummary> {
  const needs: AccountantNeed[] = []

  // 1. Missing documents (uploaded but not processed)
  const { count: unprocessedDocs } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .eq("status", "new")

  if (unprocessedDocs && unprocessedDocs > 0) {
    needs.push({
      type: "missing_document",
      title: "Nespracované dokumenty",
      description: `${unprocessedDocs} dokumentov čaká na spracovanie`,
      count: unprocessedDocs,
      severity: unprocessedDocs > 10 ? "high" : "medium",
      actionUrl: "/documents?status=new",
    })
  }

  // 2. Incomplete invoices (draft status)
  const { count: draftInvoices } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("status", "draft")

  if (draftInvoices && draftInvoices > 0) {
    needs.push({
      type: "incomplete_invoice",
      title: "Nedokončené faktúry",
      description: `${draftInvoices} faktúr v stave rozpracované`,
      count: draftInvoices,
      severity: "medium",
      actionUrl: "/invoices?status=draft",
    })
  }

  // 3. Pending approval
  const { count: pendingApproval } = await supabase
    .from("documents")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("deleted_at", null)
    .eq("status", "awaiting_review")

  if (pendingApproval && pendingApproval > 0) {
    needs.push({
      type: "pending_approval",
      title: "Čakajú na schválenie",
      description: `${pendingApproval} dokumentov čaká na vaše schválenie`,
      count: pendingApproval,
      severity: pendingApproval > 5 ? "high" : "medium",
      actionUrl: "/documents?status=awaiting_review",
    })
  }

  // 4. Unmatched bank transactions
  const { count: unmatchedTx } = await supabase
    .from("bank_transactions")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("matched_invoice_id", null)

  if (unmatchedTx && unmatchedTx > 0) {
    needs.push({
      type: "unmatched_transaction",
      title: "Nespárované transakcie",
      description: `${unmatchedTx} bankových transakcií bez párovej faktúry`,
      count: unmatchedTx,
      severity: unmatchedTx > 20 ? "high" : "low",
      actionUrl: "/bank/reconciliation",
    })
  }

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 }
  needs.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])

  const totalIssues = needs.reduce((s, n) => s + n.count, 0)
  const urgentCount = needs.filter((n) => n.severity === "high").reduce((s, n) => s + n.count, 0)

  return { needs, totalIssues, urgentCount }
}
