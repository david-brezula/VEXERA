/**
 * Health Check Service
 *
 * Runs automated quality checks on documents and invoices to catch
 * issues before deadlines: missing VAT, duplicates, unusual amounts,
 * missing fields, date inconsistencies.
 *
 * Each check produces results with severity (critical/warning/info)
 * and optional details for accountant review.
 *
 * Usage:
 *   const run = await runHealthChecks(supabase, orgId, userId)
 *   const score = await calculateRiskScore(supabase, orgId)
 */

import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Types ───────────────────────────────────────────────────────────────────

export type CheckType =
  | "missing_vat"
  | "duplicate_suspect"
  | "unusual_amount"
  | "missing_field"
  | "date_inconsistency"
  | "unmatched_payment"
  | "missing_category"
  | "supplier_mismatch"

export type Severity = "critical" | "warning" | "info"

export interface HealthCheckIssue {
  documentId?: string | null
  invoiceId?: string | null
  checkType: CheckType
  severity: Severity
  message: string
  details?: Record<string, unknown>
}

export interface HealthCheckRunResult {
  runId: string
  totalIssues: number
  criticalCount: number
  warningCount: number
  infoCount: number
}

export interface RiskScore {
  organizationId: string
  score: number        // 0-100, higher = more risk
  totalDocuments: number
  issueCount: number
  criticalCount: number
}

// ─── Internal document type for queries ──────────────────────────────────────

interface DocRow {
  id: string
  organization_id: string
  supplier_name: string | null
  supplier_ico: string | null
  supplier_ic_dph: string | null
  document_type: string | null
  category: string | null
  total_amount: number | null
  vat_amount: number | null
  vat_rate: number | null
  currency: string | null
  issue_date: string | null
  due_date: string | null
  variable_symbol: string | null
  status: string | null
  created_at: string
}

// ─── Run All Checks ──────────────────────────────────────────────────────────

export async function runHealthChecks(
  supabase: SupabaseClient,
  organizationId: string,
  userId?: string | null
): Promise<HealthCheckRunResult | null> {
  try {
    // Create a new check run
    const { data: run, error: runError } = await supabase.from("health_check_runs")
      .insert({
        organization_id: organizationId,
        triggered_by: userId ?? null,
        status: "running",
      })
      .select("id")
      .single()

    if (runError || !run) {
      console.error("[health-check] Failed to create run:", runError?.message)
      return null
    }

    const runId = (run as { id: string }).id

    // Fetch all active documents for the org
    const { data: docsData } = await supabase
      .from("documents")
      .select("id, organization_id, supplier_name, supplier_ico, supplier_ic_dph, document_type, category, total_amount, vat_amount, vat_rate, currency, issue_date, due_date, variable_symbol, status, created_at")
      .eq("organization_id", organizationId)
      .is("deleted_at", null)

    const docs = (docsData ?? []) as DocRow[]

    // Run all checks in parallel
    const allIssues: HealthCheckIssue[] = []

    const checkResults = await Promise.allSettled([
      checkMissingVat(docs),
      checkMissingFields(docs),
      checkDateInconsistencies(docs),
      checkMissingCategory(docs),
      checkUnusualAmounts(docs),
      checkDuplicateSuspects(docs),
    ])

    for (const result of checkResults) {
      if (result.status === "fulfilled") {
        allIssues.push(...result.value)
      }
    }

    // Insert all results
    if (allIssues.length > 0) {
      const rows = allIssues.map(issue => ({
        organization_id: organizationId,
        check_run_id: runId,
        document_id: issue.documentId ?? null,
        invoice_id: issue.invoiceId ?? null,
        check_type: issue.checkType,
        severity: issue.severity,
        message: issue.message,
        details: issue.details ?? {},
      }))

      await supabase.from("health_check_results").insert(rows)
    }

    // Update run with counts
    const criticalCount = allIssues.filter(i => i.severity === "critical").length
    const warningCount = allIssues.filter(i => i.severity === "warning").length
    const infoCount = allIssues.filter(i => i.severity === "info").length

    await supabase.from("health_check_runs")
      .update({
        status: "completed",
        total_issues: allIssues.length,
        critical_count: criticalCount,
        warning_count: warningCount,
        info_count: infoCount,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId)

    return {
      runId,
      totalIssues: allIssues.length,
      criticalCount,
      warningCount,
      infoCount,
    }
  } catch (err) {
    console.error("[health-check] Unexpected error running checks:", err)
    return null
  }
}

// ─── Individual Checks ───────────────────────────────────────────────────────

/**
 * Documents with a total amount but no VAT rate/amount where one would be expected.
 */
function checkMissingVat(docs: DocRow[]): HealthCheckIssue[] {
  const issues: HealthCheckIssue[] = []

  for (const doc of docs) {
    if (
      doc.total_amount &&
      doc.total_amount > 0 &&
      (doc.vat_rate === null || doc.vat_rate === undefined) &&
      (doc.vat_amount === null || doc.vat_amount === undefined || doc.vat_amount === 0)
    ) {
      // Skip documents explicitly marked as non-VAT types
      if (doc.document_type === "receipt" || doc.document_type === "internal") continue

      issues.push({
        documentId: doc.id,
        checkType: "missing_vat",
        severity: "warning",
        message: `Doklad od "${doc.supplier_name ?? "neznámy"}" za ${doc.total_amount} ${doc.currency ?? "EUR"} nemá uvedenú DPH sadzbu.`,
        details: {
          supplier: doc.supplier_name,
          amount: doc.total_amount,
          currency: doc.currency,
        },
      })
    }
  }

  return issues
}

/**
 * Documents missing key fields: supplier, amount, date, VS.
 */
function checkMissingFields(docs: DocRow[]): HealthCheckIssue[] {
  const issues: HealthCheckIssue[] = []

  for (const doc of docs) {
    const missing: string[] = []

    if (!doc.supplier_name) missing.push("dodávateľ")
    if (doc.total_amount === null || doc.total_amount === undefined) missing.push("suma")
    if (!doc.issue_date) missing.push("dátum vystavenia")

    // VS is required for invoices
    if (
      (doc.document_type === "invoice_received" || doc.document_type === "invoice_issued") &&
      !doc.variable_symbol
    ) {
      missing.push("variabilný symbol")
    }

    if (missing.length > 0) {
      issues.push({
        documentId: doc.id,
        checkType: "missing_field",
        severity: missing.includes("suma") || missing.includes("dodávateľ") ? "critical" : "warning",
        message: `Dokladu chýbajú údaje: ${missing.join(", ")}.`,
        details: { missingFields: missing },
      })
    }
  }

  return issues
}

/**
 * Date inconsistencies: issue_date after due_date, future dates, etc.
 */
function checkDateInconsistencies(docs: DocRow[]): HealthCheckIssue[] {
  const issues: HealthCheckIssue[] = []
  const now = new Date()
  const futureThreshold = new Date()
  futureThreshold.setDate(futureThreshold.getDate() + 30)

  for (const doc of docs) {
    // Issue date after due date
    if (doc.issue_date && doc.due_date && doc.issue_date > doc.due_date) {
      issues.push({
        documentId: doc.id,
        checkType: "date_inconsistency",
        severity: "warning",
        message: `Dátum vystavenia (${doc.issue_date}) je po dátume splatnosti (${doc.due_date}).`,
        details: { issueDate: doc.issue_date, dueDate: doc.due_date },
      })
    }

    // Issue date too far in the future
    if (doc.issue_date) {
      const issueDateObj = new Date(doc.issue_date)
      if (issueDateObj > futureThreshold) {
        issues.push({
          documentId: doc.id,
          checkType: "date_inconsistency",
          severity: "info",
          message: `Dátum vystavenia (${doc.issue_date}) je v budúcnosti (> 30 dní).`,
          details: { issueDate: doc.issue_date },
        })
      }
    }

    // Very old document (> 2 years)
    if (doc.issue_date) {
      const twoYearsAgo = new Date(now)
      twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)
      const issueDateObj = new Date(doc.issue_date)
      if (issueDateObj < twoYearsAgo && doc.status !== "archived") {
        issues.push({
          documentId: doc.id,
          checkType: "date_inconsistency",
          severity: "info",
          message: `Doklad z ${doc.issue_date} je starší ako 2 roky a nie je archivovaný.`,
          details: { issueDate: doc.issue_date },
        })
      }
    }
  }

  return issues
}

/**
 * Documents without a category assigned.
 */
function checkMissingCategory(docs: DocRow[]): HealthCheckIssue[] {
  const issues: HealthCheckIssue[] = []

  for (const doc of docs) {
    if (!doc.category && doc.status !== "new" && doc.status !== "processing") {
      issues.push({
        documentId: doc.id,
        checkType: "missing_category",
        severity: "warning",
        message: `Doklad od "${doc.supplier_name ?? "neznámy"}" nemá priradenú kategóriu.`,
        details: { supplier: doc.supplier_name, status: doc.status },
      })
    }
  }

  return issues
}

/**
 * Amounts that are statistical outliers for a given supplier (> 3 stddev).
 */
function checkUnusualAmounts(docs: DocRow[]): HealthCheckIssue[] {
  const issues: HealthCheckIssue[] = []

  // Group documents by supplier
  const supplierGroups = new Map<string, DocRow[]>()
  for (const doc of docs) {
    if (!doc.supplier_name || doc.total_amount === null || doc.total_amount === undefined) continue
    const key = doc.supplier_name.toLowerCase().trim()
    const group = supplierGroups.get(key) ?? []
    group.push(doc)
    supplierGroups.set(key, group)
  }

  for (const [, group] of supplierGroups) {
    if (group.length < 3) continue  // need at least 3 docs for meaningful stats

    const amounts = group.map(d => d.total_amount!).filter(a => a > 0)
    if (amounts.length < 3) continue

    const mean = amounts.reduce((s, a) => s + a, 0) / amounts.length
    const variance = amounts.reduce((s, a) => s + (a - mean) ** 2, 0) / amounts.length
    const stddev = Math.sqrt(variance)

    if (stddev === 0) continue  // all same amount

    for (const doc of group) {
      if (doc.total_amount === null || doc.total_amount === undefined) continue
      const zScore = Math.abs((doc.total_amount - mean) / stddev)

      if (zScore > 3) {
        issues.push({
          documentId: doc.id,
          checkType: "unusual_amount",
          severity: "warning",
          message: `Suma ${doc.total_amount} ${doc.currency ?? "EUR"} od "${doc.supplier_name}" je nezvyčajne ${doc.total_amount > mean ? "vysoká" : "nízka"} (priemer: ${mean.toFixed(2)}).`,
          details: {
            amount: doc.total_amount,
            mean: Number(mean.toFixed(2)),
            stddev: Number(stddev.toFixed(2)),
            zScore: Number(zScore.toFixed(2)),
            supplier: doc.supplier_name,
          },
        })
      }
    }
  }

  return issues
}

/**
 * Suspected duplicates: same supplier + similar amount + close dates.
 */
function checkDuplicateSuspects(docs: DocRow[]): HealthCheckIssue[] {
  const issues: HealthCheckIssue[] = []
  const reported = new Set<string>()

  for (let i = 0; i < docs.length; i++) {
    for (let j = i + 1; j < docs.length; j++) {
      const a = docs[i]
      const b = docs[j]

      // Same supplier
      if (!a.supplier_name || !b.supplier_name) continue
      if (a.supplier_name.toLowerCase().trim() !== b.supplier_name.toLowerCase().trim()) continue

      // Same amount
      if (a.total_amount === null || b.total_amount === null) continue
      if (a.total_amount !== b.total_amount) continue

      // Close dates (within 3 days)
      if (a.issue_date && b.issue_date) {
        const daysDiff = Math.abs(
          (new Date(a.issue_date).getTime() - new Date(b.issue_date).getTime()) / (1000 * 60 * 60 * 24)
        )
        if (daysDiff > 3) continue
      }

      // Avoid reporting the same pair twice
      const pairKey = [a.id, b.id].sort().join("-")
      if (reported.has(pairKey)) continue
      reported.add(pairKey)

      issues.push({
        documentId: a.id,
        checkType: "duplicate_suspect",
        severity: "critical",
        message: `Možný duplikát: "${a.supplier_name}" za ${a.total_amount} ${a.currency ?? "EUR"} (doklady ${a.id.slice(0, 8)} a ${b.id.slice(0, 8)}).`,
        details: {
          documentA: a.id,
          documentB: b.id,
          supplier: a.supplier_name,
          amount: a.total_amount,
          dateA: a.issue_date,
          dateB: b.issue_date,
        },
      })
    }
  }

  return issues
}

// ─── Risk Score ──────────────────────────────────────────────────────────────

/**
 * Calculate a risk score (0-100) for an organization based on recent health check results.
 * Higher score = more issues relative to document count.
 */
export async function calculateRiskScore(
  supabase: SupabaseClient,
  organizationId: string
): Promise<RiskScore> {
  try {
    // Get the latest completed run
    const { data: latestRun } = await supabase
      .from("health_check_runs")
      .select("id, total_issues, critical_count, warning_count")
      .eq("organization_id", organizationId)
      .eq("status", "completed")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    // Count total documents
    const { count: docCount } = await supabase
      .from("documents")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", organizationId)
      .is("deleted_at", null)

    const totalDocuments = docCount ?? 0

    if (!latestRun || totalDocuments === 0) {
      return {
        organizationId,
        score: 0,
        totalDocuments,
        issueCount: 0,
        criticalCount: 0,
      }
    }

    const run = latestRun as {
      total_issues: number
      critical_count: number
      warning_count: number
    }

    // Score formula: critical issues count double
    const weightedIssues = run.critical_count * 2 + run.warning_count
    const ratio = weightedIssues / totalDocuments
    const score = Math.min(100, Math.round(ratio * 100))

    return {
      organizationId,
      score,
      totalDocuments,
      issueCount: run.total_issues,
      criticalCount: run.critical_count,
    }
  } catch (err) {
    console.error("[health-check] Error calculating risk score:", err)
    return { organizationId, score: 0, totalDocuments: 0, issueCount: 0, criticalCount: 0 }
  }
}

// ─── Query Helpers ───────────────────────────────────────────────────────────

export async function getLatestHealthCheckRun(
  supabase: SupabaseClient,
  organizationId: string
) {
  const { data, error } = await supabase
    .from("health_check_runs")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single()

  if (error) return null
  return data
}

export async function getHealthCheckIssues(
  supabase: SupabaseClient,
  organizationId: string,
  options?: {
    runId?: string
    resolved?: boolean
    severity?: Severity
    checkType?: CheckType
    limit?: number
    offset?: number
  }
) {
  let query = supabase
    .from("health_check_results")
    .select("*")
    .eq("organization_id", organizationId)
    .order("severity", { ascending: true })  // critical first
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 50)

  if (options?.runId) query = query.eq("check_run_id", options.runId)
  if (options?.resolved !== undefined) query = query.eq("resolved", options.resolved)
  if (options?.severity) query = query.eq("severity", options.severity)
  if (options?.checkType) query = query.eq("check_type", options.checkType)
  if (options?.offset) query = query.range(options.offset, options.offset + (options.limit ?? 50) - 1)

  const { data, error } = await query

  if (error) {
    console.error("[health-check] Failed to fetch issues:", error.message)
    return []
  }

  return data ?? []
}

export async function resolveHealthCheckIssue(
  supabase: SupabaseClient,
  issueId: string,
  userId: string
): Promise<boolean> {
  const { error } = await supabase.from("health_check_results")
    .update({
      resolved: true,
      resolved_at: new Date().toISOString(),
      resolved_by: userId,
    })
    .eq("id", issueId)

  if (error) {
    console.error("[health-check] Failed to resolve issue:", error.message)
    return false
  }
  return true
}
