"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { generateCategoryReport } from "@/lib/services/reports/category-report.service"
import { generateAllTagsPLSummary } from "@/lib/services/reports/client-project-pl.service"
import { generateRemainingWork } from "@/lib/services/reports/remaining-work.service"
import { getCashFlowSummary, forecast } from "@/lib/services/cashflow.service"

// ─── Shared HTML builder (non-exported) ─────────────────────────────────────

function buildReportHtml(opts: {
  orgName: string
  title: string
  period?: string
  summaryCards: { label: string; value: string; color?: string }[]
  tables: { title: string; headers: string[]; rows: string[][] }[]
}): string {
  const { orgName, title, period, summaryCards, tables } = opts
  const now = new Date().toLocaleDateString("sk-SK", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  const summaryHtml = summaryCards
    .map(
      (c) => `
      <div class="summary-card">
        <div class="summary-label">${c.label}</div>
        <div class="summary-value" style="color:${c.color ?? "#111"}">${c.value}</div>
      </div>`
    )
    .join("")

  const tablesHtml = tables
    .map(
      (t) => `
      <h3>${t.title}</h3>
      <table>
        <thead>
          <tr>${t.headers.map((h) => `<th>${h}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${t.rows
            .map(
              (row, i) =>
                `<tr class="${i % 2 === 1 ? "zebra" : ""}">${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`
            )
            .join("")}
        </tbody>
      </table>`
    )
    .join("")

  return `<!DOCTYPE html>
<html lang="sk">
<head>
  <meta charset="UTF-8" />
  <title>${title} — ${orgName}</title>
  <style>
    @page { size: A4; margin: 15mm; }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; color: #111; max-width: 210mm; margin: 0 auto; padding: 20px; font-size: 12px; line-height: 1.5; }
    h1 { font-size: 20px; margin-bottom: 4px; }
    h3 { font-size: 14px; margin: 20px 0 8px; page-break-after: avoid; }
    .header { margin-bottom: 16px; border-bottom: 2px solid #111; padding-bottom: 8px; }
    .org-name { font-size: 14px; color: #555; }
    .period { font-size: 12px; color: #777; margin-top: 2px; }
    .summary-row { display: flex; gap: 12px; margin: 16px 0; flex-wrap: wrap; }
    .summary-card { flex: 1; min-width: 120px; border: 1px solid #ddd; border-radius: 6px; padding: 10px; }
    .summary-label { font-size: 10px; color: #777; text-transform: uppercase; letter-spacing: 0.5px; }
    .summary-value { font-size: 18px; font-weight: 700; margin-top: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; page-break-inside: auto; }
    th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #333; font-size: 11px; text-transform: uppercase; letter-spacing: 0.3px; color: #555; }
    td { padding: 6px 8px; border-bottom: 1px solid #eee; font-size: 12px; }
    tr.zebra td { background: #f9f9f9; }
    .text-right { text-align: right; }
    .footer { margin-top: 24px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 10px; color: #999; }
    @media print {
      body { padding: 0; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${title}</h1>
    <div class="org-name">${orgName}</div>
    ${period ? `<div class="period">${period}</div>` : ""}
  </div>
  <div class="summary-row">${summaryHtml}</div>
  ${tablesHtml}
  <div class="footer">Vygenerované: ${now} | VEXERA</div>
</body>
</html>`
}

function fmtNum(n: number, currency?: string): string {
  const formatted = n.toLocaleString("sk-SK", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return currency ? `${formatted} ${currency}` : formatted
}

async function getOrgName(supabase: Awaited<ReturnType<typeof createClient>>, orgId: string): Promise<string> {
  const { data } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single()
  return (data as unknown as { name: string } | null)?.name ?? "Organizácia"
}

// ─── PDF Export Actions ─────────────────────────────────────────────────────

export async function exportCategoryReportPdfAction(
  periodFrom: string,
  periodTo: string,
  currency?: string
): Promise<{ html: string; filename: string } | { error: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const [report, orgName] = await Promise.all([
      generateCategoryReport(supabase, orgId, { from: periodFrom, to: periodTo }, currency ?? "EUR"),
      getOrgName(supabase, orgId),
    ])

    const html = buildReportHtml({
      orgName,
      title: "Prehľad podľa kategórií",
      period: `${periodFrom} — ${periodTo}`,
      summaryCards: [
        { label: "Výnosy", value: fmtNum(report.totalRevenue, report.currency), color: "#16a34a" },
        { label: "Náklady", value: fmtNum(report.totalExpenses, report.currency), color: "#dc2626" },
        {
          label: "Zisk",
          value: fmtNum(report.totalRevenue - report.totalExpenses, report.currency),
          color: report.totalRevenue - report.totalExpenses >= 0 ? "#16a34a" : "#dc2626",
        },
      ],
      tables: [
        {
          title: "Náklady podľa kategórie",
          headers: ["Kategória", "Suma", "Počet", "%"],
          rows: report.expensesByCategory.map((r) => [
            r.category,
            fmtNum(r.totalAmount, report.currency),
            String(r.transactionCount),
            `${r.percentage}%`,
          ]),
        },
        {
          title: "Výnosy podľa kategórie",
          headers: ["Kategória", "Suma", "Počet", "%"],
          rows: report.revenueByCategory.map((r) => [
            r.category,
            fmtNum(r.totalAmount, report.currency),
            String(r.transactionCount),
            `${r.percentage}%`,
          ]),
        },
      ],
    })

    const filename = `kategorie_${periodFrom}_${periodTo}.html`
    return { html, filename }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Export failed" }
  }
}

export async function exportPLReportPdfAction(
  periodFrom: string,
  periodTo: string,
  tagType: "client" | "project",
  currency?: string
): Promise<{ html: string; filename: string } | { error: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const [reports, orgName] = await Promise.all([
      generateAllTagsPLSummary(supabase, orgId, tagType, { from: periodFrom, to: periodTo }, currency ?? "EUR"),
      getOrgName(supabase, orgId),
    ])

    const totalRevenue = reports.reduce((s, r) => s + r.totalRevenue, 0)
    const totalExpenses = reports.reduce((s, r) => s + r.totalExpenses, 0)
    const totalProfit = totalRevenue - totalExpenses

    const titleLabel = tagType === "client" ? "Klienti" : "Projekty"

    const html = buildReportHtml({
      orgName,
      title: `Ziskovosť — ${titleLabel}`,
      period: `${periodFrom} — ${periodTo}`,
      summaryCards: [
        { label: "Celkové výnosy", value: fmtNum(totalRevenue, "EUR"), color: "#16a34a" },
        { label: "Celkové náklady", value: fmtNum(totalExpenses, "EUR"), color: "#dc2626" },
        {
          label: "Celkový zisk",
          value: fmtNum(totalProfit, "EUR"),
          color: totalProfit >= 0 ? "#16a34a" : "#dc2626",
        },
      ],
      tables: [
        {
          title: `${titleLabel} — prehľad`,
          headers: [tagType === "client" ? "Klient" : "Projekt", "Výnosy", "Náklady", "Zisk", "Marža"],
          rows: reports.map((r) => [
            r.entityName,
            fmtNum(r.totalRevenue, r.currency),
            fmtNum(r.totalExpenses, r.currency),
            fmtNum(r.netProfit, r.currency),
            `${r.margin}%`,
          ]),
        },
      ],
    })

    const filename = `pl_${tagType}_${periodFrom}_${periodTo}.html`
    return { html, filename }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Export failed" }
  }
}

export async function exportCashflowReportPdfAction(): Promise<
  { html: string; filename: string } | { error: string }
> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const [summary, forecastPoints, orgName] = await Promise.all([
      getCashFlowSummary(supabase, orgId),
      forecast(supabase, orgId, 90),
      getOrgName(supabase, orgId),
    ])

    const weeklyPoints = forecastPoints.filter((_, i) => i % 7 === 0 || i === forecastPoints.length - 1)

    const html = buildReportHtml({
      orgName,
      title: "Cashflow Forecast",
      period: `90-dňová projekcia`,
      summaryCards: [
        { label: "Aktuálny zostatok", value: fmtNum(summary.current_balance, "EUR") },
        { label: "30-dňový výhľad", value: fmtNum(summary.forecast_30d, "EUR") },
        { label: "60-dňový výhľad", value: fmtNum(summary.forecast_60d, "EUR") },
        { label: "90-dňový výhľad", value: fmtNum(summary.forecast_90d, "EUR") },
        {
          label: "Rizikový dátum",
          value: summary.risk_date ?? "Žiadny",
          color: summary.risk_date ? "#dc2626" : "#16a34a",
        },
      ],
      tables: [
        {
          title: "Týždenná projekcia",
          headers: ["Dátum", "Príjmy", "Výdavky", "Zostatok"],
          rows: weeklyPoints.map((p) => [
            new Date(p.date).toLocaleDateString("sk-SK"),
            fmtNum(p.inflows, "EUR"),
            fmtNum(p.outflows, "EUR"),
            fmtNum(p.projected_balance, "EUR"),
          ]),
        },
      ],
    })

    return { html, filename: "cashflow_forecast.html" }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Export failed" }
  }
}

export async function exportRemainingWorkReportPdfAction(): Promise<
  { html: string; filename: string } | { error: string }
> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const [report, orgName] = await Promise.all([
      generateRemainingWork(supabase, [orgId]),
      getOrgName(supabase, orgId),
    ])

    const html = buildReportHtml({
      orgName,
      title: "Zostávajúca práca",
      summaryCards: [
        { label: "Najbližší termín", value: report.deadlineLabel },
        { label: "Zostáva dní", value: String(report.daysUntil), color: report.daysUntil <= 7 ? "#dc2626" : undefined },
        { label: "Celková pripravenosť", value: `${report.overallReadiness}%` },
      ],
      tables: [
        {
          title: "Prehľad klientov",
          headers: ["Organizácia", "Nespracované doklady", "Nepárované transakcie", "Neschválené faktúry", "Zdravotné problémy", "Pripravenosť"],
          rows: report.clients.map((c) => [
            c.organizationName,
            String(c.unprocessedDocuments),
            String(c.unmatchedTransactions),
            String(c.unapprovedInvoices),
            String(c.healthCheckIssues),
            `${c.readinessPercent}%`,
          ]),
        },
      ],
    })

    return { html, filename: "zostavajuca_praca.html" }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Export failed" }
  }
}

// ─── Excel/CSV Export Actions ───────────────────────────────────────────────

function buildCsv(headers: string[], rows: string[][]): string {
  const escape = (val: string) => {
    if (val.includes(",") || val.includes('"') || val.includes("\n")) {
      return `"${val.replace(/"/g, '""')}"`
    }
    return val
  }
  const lines = [headers.map(escape).join(",")]
  for (const row of rows) {
    lines.push(row.map(escape).join(","))
  }
  return "\uFEFF" + lines.join("\r\n")
}

export async function exportCategoryReportExcelAction(
  periodFrom: string,
  periodTo: string,
  currency?: string
): Promise<{ base64: string; filename: string } | { error: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const report = await generateCategoryReport(supabase, orgId, { from: periodFrom, to: periodTo }, currency ?? "EUR")

    const headers = ["Typ", "Kategória", "Suma", "Počet", "%"]
    const rows: string[][] = []

    for (const r of report.expensesByCategory) {
      rows.push(["Náklad", r.category, fmtNum(r.totalAmount), String(r.transactionCount), `${r.percentage}%`])
    }
    for (const r of report.revenueByCategory) {
      rows.push(["Výnos", r.category, fmtNum(r.totalAmount), String(r.transactionCount), `${r.percentage}%`])
    }

    // Summary rows
    rows.push([])
    rows.push(["", "Celkové náklady", fmtNum(report.totalExpenses), "", ""])
    rows.push(["", "Celkové výnosy", fmtNum(report.totalRevenue), "", ""])
    rows.push(["", "Zisk", fmtNum(report.totalRevenue - report.totalExpenses), "", ""])

    const csv = buildCsv(headers, rows)
    const base64 = Buffer.from(csv, "utf-8").toString("base64")
    const filename = `kategorie_${periodFrom}_${periodTo}.csv`

    return { base64, filename }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Export failed" }
  }
}

export async function exportPLReportExcelAction(
  periodFrom: string,
  periodTo: string,
  tagType: "client" | "project",
  currency?: string
): Promise<{ base64: string; filename: string } | { error: string }> {
  try {
    const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
    if (!orgId) return { error: "No active organization" }

    const reports = await generateAllTagsPLSummary(
      supabase,
      orgId,
      tagType,
      { from: periodFrom, to: periodTo },
      currency ?? "EUR"
    )

    const entityLabel = tagType === "client" ? "Klient" : "Projekt"
    const headers = [entityLabel, "Výnosy", "Náklady", "Zisk", "Marža"]
    const rows: string[][] = []

    for (const r of reports) {
      rows.push([r.entityName, fmtNum(r.totalRevenue), fmtNum(r.totalExpenses), fmtNum(r.netProfit), `${r.margin}%`])
    }

    // Summary
    const totalRevenue = reports.reduce((s, r) => s + r.totalRevenue, 0)
    const totalExpenses = reports.reduce((s, r) => s + r.totalExpenses, 0)
    rows.push([])
    rows.push(["Celkom", fmtNum(totalRevenue), fmtNum(totalExpenses), fmtNum(totalRevenue - totalExpenses), ""])

    const csv = buildCsv(headers, rows)
    const base64 = Buffer.from(csv, "utf-8").toString("base64")
    const filename = `pl_${tagType}_${periodFrom}_${periodTo}.csv`

    return { base64, filename }
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Export failed" }
  }
}
