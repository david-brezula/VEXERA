import { createClient } from "@/lib/supabase/server"
import type { AccountantDashboardData, ClientSummary } from "@vexera/types"

/**
 * Fetches all client data for an accounting firm's dashboard.
 *
 * 1. Gets active client organizations linked via `accountant_clients` table
 * 2. For each client, aggregates document counts, bank transaction status, last activity
 * 3. Calculates auto-processing rates, client statuses, and firm-wide totals
 */
export async function getAccountantDashboard(
  orgId: string
): Promise<AccountantDashboardData> {
  const supabase = await createClient()

  // 1. Get all active client organizations
  // Get current user to find their accountant_clients links
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return emptyDashboard()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: clientLinks, error: clientError } = await (supabase as any)
    .from("accountant_clients")
    .select("id, organization_id, organizations:organization_id(id, name)")
    .eq("accountant_id", user.id)
    .eq("status", "active")

  if (clientError) {
    console.error("[accountant-dashboard] Failed to fetch client links:", clientError.message)
    return emptyDashboard()
  }

  const links = (clientLinks ?? []) as Array<{
    id: string
    organization_id: string
    organizations: { id: string; name: string } | null
  }>

  if (links.length === 0) return emptyDashboard()

  const clientOrgIds = links.map((l) => l.organization_id)

  // 2. Fetch document stats for all client orgs in parallel
  const [docStats, txStats, lastActivities, weeklyApproved] = await Promise.all([
    fetchDocumentStats(supabase, clientOrgIds),
    fetchUnmatchedTransactions(supabase, clientOrgIds),
    fetchLastActivities(supabase, clientOrgIds),
    fetchWeeklyApproved(supabase, clientOrgIds),
  ])

  const now = new Date()

  // 3. Build client summaries
  const clients: ClientSummary[] = links.map((link) => {
    const orgId = link.organization_id
    const orgName = link.organizations?.name ?? "Unknown"

    const total = docStats.total.get(orgId) ?? 0
    const unprocessed = docStats.unprocessed.get(orgId) ?? 0
    const autoProcessed = docStats.autoProcessed.get(orgId) ?? 0
    const unmatchedTx = txStats.get(orgId) ?? 0
    const lastActivityAt = lastActivities.get(orgId) ?? null

    const autoProcessRate = total > 0 ? (autoProcessed / total) * 100 : 0

    const daysSinceActivity = lastActivityAt
      ? Math.floor((now.getTime() - new Date(lastActivityAt).getTime()) / (1000 * 60 * 60 * 24))
      : Infinity

    let status: ClientSummary["status"] = "on_track"
    if (daysSinceActivity > 30) {
      status = "idle"
    } else if (unprocessed > 10 || daysSinceActivity > 14) {
      status = "needs_attention"
    }

    return {
      accountant_client_id: link.id,
      organization_id: orgId,
      organization_name: orgName,
      unprocessed_docs: unprocessed,
      auto_processed_docs: autoProcessed,
      total_docs: total,
      auto_process_rate: Math.round(autoProcessRate * 100) / 100,
      unmatched_transactions: unmatchedTx,
      last_activity_at: lastActivityAt,
      days_since_activity: daysSinceActivity === Infinity ? -1 : daysSinceActivity,
      status,
    }
  })

  // 4. Sort: needs_attention first, then by unprocessed DESC
  const statusOrder: Record<string, number> = { needs_attention: 0, on_track: 1, idle: 2 }
  clients.sort((a, b) => {
    const statusDiff = (statusOrder[a.status] ?? 1) - (statusOrder[b.status] ?? 1)
    if (statusDiff !== 0) return statusDiff
    return b.unprocessed_docs - a.unprocessed_docs
  })

  // 5. Aggregate totals
  const totalUnprocessed = clients.reduce((s, c) => s + c.unprocessed_docs, 0)
  const totalAutoProcessed = clients.reduce((s, c) => s + c.auto_processed_docs, 0)
  const totalDocs = clients.reduce((s, c) => s + c.total_docs, 0)
  const overallAutoRate = totalDocs > 0 ? (totalAutoProcessed / totalDocs) * 100 : 0

  // 6. Weekly approved count
  const docsProcessedThisWeek = Array.from(weeklyApproved.values()).reduce((s, c) => s + c, 0)

  // 7. Estimated hours saved: auto_processed * 3 min / 60
  const estimatedHoursSaved = Math.round((totalAutoProcessed * 3) / 60 * 100) / 100

  // 8. Fetch referral code from accounting_firm_profiles
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: firmProfile } = await (supabase.from("accounting_firm_profiles") as any)
    .select("referral_code")
    .eq("organization_id", orgId)
    .single()

  return {
    clients,
    total_clients: clients.length,
    total_unprocessed: totalUnprocessed,
    total_auto_processed: totalAutoProcessed,
    overall_auto_rate: Math.round(overallAutoRate * 100) / 100,
    docs_processed_this_week: docsProcessedThisWeek,
    estimated_hours_saved: estimatedHoursSaved,
    referral_code: firmProfile?.referral_code ?? null,
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyDashboard(): AccountantDashboardData {
  return {
    clients: [],
    total_clients: 0,
    total_unprocessed: 0,
    total_auto_processed: 0,
    overall_auto_rate: 0,
    docs_processed_this_week: 0,
    estimated_hours_saved: 0,
    referral_code: null,
  }
}

async function fetchDocumentStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgIds: string[]
): Promise<{
  total: Map<string, number>
  unprocessed: Map<string, number>
  autoProcessed: Map<string, number>
}> {
  const total = new Map<string, number>()
  const unprocessed = new Map<string, number>()
  const autoProcessed = new Map<string, number>()

  // Fetch all docs with status for client orgs
  const { data, error } = await supabase
    .from("documents")
    .select("organization_id, status")
    .in("organization_id", orgIds)
    .is("deleted_at", null)

  if (error) {
    console.error("[accountant-dashboard] doc stats error:", error.message)
    return { total, unprocessed, autoProcessed }
  }

  const rows = (data ?? []) as Array<{ organization_id: string; status: string }>

  for (const row of rows) {
    total.set(row.organization_id, (total.get(row.organization_id) ?? 0) + 1)

    if (row.status === "new") {
      unprocessed.set(row.organization_id, (unprocessed.get(row.organization_id) ?? 0) + 1)
    }

    if (row.status === "auto_processed") {
      autoProcessed.set(row.organization_id, (autoProcessed.get(row.organization_id) ?? 0) + 1)
    }
  }

  return { total, unprocessed, autoProcessed }
}

async function fetchUnmatchedTransactions(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>()

  const { data, error } = await supabase
    .from("bank_transactions")
    .select("organization_id")
    .in("organization_id", orgIds)
    .eq("match_status", "unmatched")

  if (error) {
    console.error("[accountant-dashboard] tx stats error:", error.message)
    return result
  }

  const rows = (data ?? []) as Array<{ organization_id: string }>
  for (const row of rows) {
    result.set(row.organization_id, (result.get(row.organization_id) ?? 0) + 1)
  }

  return result
}

async function fetchLastActivities(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgIds: string[]
): Promise<Map<string, string>> {
  const result = new Map<string, string>()

  // Most recent document created_at per org
  const { data: docData } = await supabase
    .from("documents")
    .select("organization_id, created_at")
    .in("organization_id", orgIds)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })

  const docRows = (docData ?? []) as Array<{ organization_id: string; created_at: string }>
  for (const row of docRows) {
    if (!result.has(row.organization_id)) {
      result.set(row.organization_id, row.created_at)
    }
  }

  // Most recent bank_transaction created_at per org
  const { data: txData } = await supabase
    .from("bank_transactions")
    .select("organization_id, created_at")
    .in("organization_id", orgIds)
    .order("created_at", { ascending: false })

  const txRows = (txData ?? []) as Array<{ organization_id: string; created_at: string }>
  for (const row of txRows) {
    const existing = result.get(row.organization_id)
    if (!existing || new Date(row.created_at) > new Date(existing)) {
      result.set(row.organization_id, row.created_at)
    }
  }

  return result
}

async function fetchWeeklyApproved(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  orgIds: string[]
): Promise<Map<string, number>> {
  const result = new Map<string, number>()

  const oneWeekAgo = new Date()
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7)

  const { data, error } = await supabase
    .from("documents")
    .select("organization_id")
    .in("organization_id", orgIds)
    .eq("status", "approved")
    .gte("updated_at", oneWeekAgo.toISOString())
    .is("deleted_at", null)

  if (error) {
    console.error("[accountant-dashboard] weekly approved error:", error.message)
    return result
  }

  const rows = (data ?? []) as Array<{ organization_id: string }>
  for (const row of rows) {
    result.set(row.organization_id, (result.get(row.organization_id) ?? 0) + 1)
  }

  return result
}
