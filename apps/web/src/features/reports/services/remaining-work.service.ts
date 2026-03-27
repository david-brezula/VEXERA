/**
 * Remaining Work Report Service
 *
 * For accountants: shows per-client readiness status before VAT/tax deadlines.
 * Counts unprocessed documents, unmatched transactions, unapproved invoices,
 * and health check issues per organization.
 *
 * Usage:
 *   const report = await generateRemainingWork(supabase, orgIds)
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { RemainingWorkReport, RemainingWorkClient } from "./report.types"

/**
 * Generate remaining work report for given organizations.
 */
export async function generateRemainingWork(
  supabase: SupabaseClient,
  organizationIds: string[]
): Promise<RemainingWorkReport> {
  // Get the next upcoming deadline
  const now = new Date()
  const currentMonth = now.getMonth()
  const currentYear = now.getFullYear()

  // VAT deadline is 25th of next month
  const vatDeadline = new Date(currentYear, currentMonth + 1, 25)
  const daysUntil = Math.ceil((vatDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

  const clients: RemainingWorkClient[] = []

  for (const orgId of organizationIds) {
    // Get org name
    const { data: orgData } = await supabase
      .from("organizations")
      .select("name")
      .eq("id", orgId)
      .single()

    const orgName = (orgData as unknown as { name: string } | null)?.name ?? "Unknown"

    // Count unprocessed documents (status = 'new' or 'auto_processed')
    const { count: unprocessedDocs } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .in("status", ["new", "auto_processed"])

    // Count unmatched bank transactions (no matched invoice)
    const { count: unmatchedTx } = await supabase
      .from("bank_transactions")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .is("matched_invoice_id", null)

    // Count unapproved invoices (status not in approved/paid/cancelled)
    const { count: unapprovedInvoices } = await supabase
      .from("invoices")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .not("status", "in", "(approved,paid,cancelled)")

    // Count unresolved health check issues
    const { count: healthIssues } = await supabase
      .from("health_check_results")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", orgId)
      .eq("resolved", false)

    const unprocessed = unprocessedDocs ?? 0
    const unmatched = unmatchedTx ?? 0
    const unapproved = unapprovedInvoices ?? 0
    const issues = healthIssues ?? 0

    // Calculate readiness percentage
    const totalIssues = unprocessed + unmatched + unapproved + issues
    const readinessPercent = totalIssues === 0 ? 100 : Math.max(0, Math.round(100 - totalIssues * 5))

    clients.push({
      organizationId: orgId,
      organizationName: orgName,
      unprocessedDocuments: unprocessed,
      unmatchedTransactions: unmatched,
      unapprovedInvoices: unapproved,
      healthCheckIssues: issues,
      readinessPercent: Math.min(readinessPercent, 100),
    })
  }

  // Sort by readiness (lowest first — most work needed)
  clients.sort((a, b) => a.readinessPercent - b.readinessPercent)

  const overallReadiness = clients.length > 0
    ? Math.round(clients.reduce((s, c) => s + c.readinessPercent, 0) / clients.length)
    : 100

  return {
    deadline: vatDeadline.toISOString().split("T")[0],
    deadlineLabel: `DPH ${vatDeadline.toLocaleDateString("sk-SK", { month: "long", year: "numeric" })}`,
    daysUntil,
    clients,
    overallReadiness,
  }
}
