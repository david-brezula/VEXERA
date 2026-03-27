/**
 * Audit Bundle Service
 *
 * Creates a ZIP-like bundle of documents + ledger + audit logs for auditors.
 * Returns structured JSON that can be downloaded or uploaded to S3.
 *
 * Usage:
 *   const bundle = await generateAuditBundle(supabase, orgId, period)
 */

import type { SupabaseClient } from "@supabase/supabase-js"
import type { ReportPeriod } from "@/features/reports/services/report.types"
import { generateExcelCSV, type ExcelColumn } from "./excel.adapter"

export interface AuditBundleManifest {
  organizationName: string
  period: ReportPeriod
  generatedAt: string
  files: Array<{
    name: string
    type: "csv" | "json"
    size: number
  }>
}

export interface AuditBundleFile {
  name: string
  content: Buffer | string
  contentType: string
}

export interface AuditBundle {
  manifest: AuditBundleManifest
  files: AuditBundleFile[]
}

/**
 * Generate an audit bundle with all financial data for a period.
 */
export async function generateAuditBundle(
  supabase: SupabaseClient,
  organizationId: string,
  period: ReportPeriod
): Promise<AuditBundle> {
  // Get org name
  const { data: orgData } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", organizationId)
    .single()

  const orgName = (orgData as unknown as { name: string } | null)?.name ?? "Unknown"

  const files: AuditBundleFile[] = []

  // 1. Documents export
  const { data: docs } = await supabase
    .from("documents")
    .select("id, supplier_name, supplier_ico, document_type, category, total_amount, vat_amount, currency, issue_date, status")
    .eq("organization_id", organizationId)
    .gte("issue_date", period.from)
    .lte("issue_date", period.to)
    .is("deleted_at", null)
    .order("issue_date", { ascending: true })

  const docsColumns: ExcelColumn[] = [
    { header: "ID", key: "id" },
    { header: "Dodávateľ", key: "supplier_name" },
    { header: "IČO", key: "supplier_ico" },
    { header: "Typ", key: "document_type" },
    { header: "Kategória", key: "category" },
    { header: "Suma", key: "total_amount", format: "currency" },
    { header: "DPH", key: "vat_amount", format: "currency" },
    { header: "Mena", key: "currency" },
    { header: "Dátum", key: "issue_date", format: "date" },
    { header: "Stav", key: "status" },
  ]

  const docsBuffer = generateExcelCSV(
    (docs ?? []) as unknown as Record<string, unknown>[],
    docsColumns
  )
  files.push({ name: "dokumenty.csv", content: docsBuffer, contentType: "text/csv" })

  // 2. Invoices export
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_type, customer_name, total_amount, vat_amount, currency, issue_date, due_date, status, paid_at")
    .eq("organization_id", organizationId)
    .gte("issue_date", period.from)
    .lte("issue_date", period.to)
    .order("issue_date", { ascending: true })

  const invoicesColumns: ExcelColumn[] = [
    { header: "ID", key: "id" },
    { header: "Typ", key: "invoice_type" },
    { header: "Zákazník", key: "customer_name" },
    { header: "Suma", key: "total_amount", format: "currency" },
    { header: "DPH", key: "vat_amount", format: "currency" },
    { header: "Mena", key: "currency" },
    { header: "Dátum vydania", key: "issue_date", format: "date" },
    { header: "Dátum splatnosti", key: "due_date", format: "date" },
    { header: "Stav", key: "status" },
    { header: "Zaplatené", key: "paid_at", format: "date" },
  ]

  const invoicesBuffer = generateExcelCSV(
    (invoices ?? []) as unknown as Record<string, unknown>[],
    invoicesColumns
  )
  files.push({ name: "faktury.csv", content: invoicesBuffer, contentType: "text/csv" })

  // 3. Audit logs export
  const { data: auditLogs } = await supabase
    .from("audit_logs")
    .select("id, action, entity_type, entity_id, user_id, created_at")
    .eq("organization_id", organizationId)
    .gte("created_at", period.from)
    .lte("created_at", period.to + "T23:59:59")
    .order("created_at", { ascending: true })

  const auditColumns: ExcelColumn[] = [
    { header: "ID", key: "id" },
    { header: "Akcia", key: "action" },
    { header: "Typ entity", key: "entity_type" },
    { header: "ID entity", key: "entity_id" },
    { header: "Používateľ", key: "user_id" },
    { header: "Dátum", key: "created_at", format: "date" },
  ]

  const auditBuffer = generateExcelCSV(
    (auditLogs ?? []) as unknown as Record<string, unknown>[],
    auditColumns
  )
  files.push({ name: "audit_log.csv", content: auditBuffer, contentType: "text/csv" })

  // Build manifest
  const manifest: AuditBundleManifest = {
    organizationName: orgName,
    period,
    generatedAt: new Date().toISOString(),
    files: files.map((f) => ({
      name: f.name,
      type: f.name.endsWith(".csv") ? "csv" as const : "json" as const,
      size: typeof f.content === "string" ? f.content.length : f.content.length,
    })),
  }

  files.push({
    name: "manifest.json",
    content: JSON.stringify(manifest, null, 2),
    contentType: "application/json",
  })

  return { manifest, files }
}
