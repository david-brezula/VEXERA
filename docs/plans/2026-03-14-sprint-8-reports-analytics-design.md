# Sprint 8: Reports & Analytics — Design

**Goal:** Add chart visualizations, drill-down, period comparison, report exports, and snapshot caching to VEXERA's existing reports infrastructure.

**Approach:** Extend existing report pages with Recharts charts, inline accordion drill-down, comparison toggle, PDF/Excel export, and report snapshot caching. No new report services needed — all backend logic already exists.

---

## Feature 1: Recharts Integration + Category Report Charts

**Current state:** Category report shows summary cards and a table with progress bars.

### Changes

1. **Install Recharts** — `pnpm add recharts` in `apps/web`.

2. **Category breakdown bar chart** — Horizontal bar chart above the table showing top 10 categories by amount. Color-coded: blue for revenue, red for expenses. Uses `BarChart` + `Bar` + `XAxis` + `YAxis` + `Tooltip`.

3. **Compare toggle** — Switch component labeled "Compare with previous period". When enabled:
   - Fetches the same report for the equivalent previous period (Q1 2026 → Q1 2025)
   - Bar chart shows grouped bars: current + previous period side by side
   - Table shows "Previous" column with delta (arrow + percentage change)

4. **Inline drill-down** — Category table rows become expandable accordion. Clicking a row shows underlying documents/invoices for that category inline. Uses existing `documentIds` from `CategoryBreakdownRow`. Shows: document name, date, amount, status.

---

## Feature 2: P&L Report Charts + Drill-Down

**Current state:** P&L page shows summary cards and a table (Client/Project, Revenue, Expenses, Profit, Margin).

### Changes

1. **P&L bar chart** — Grouped bar chart showing revenue (green) vs expenses (red) per client/project (top 10). Profit in tooltip.

2. **Compare toggle** — Same pattern as category report. Previous period shown as lighter/ghost bars. Table gets delta columns.

3. **Inline drill-down** — Click a client/project row → accordion shows revenue and expense category breakdown with amounts. Uses existing `PLRow[]` data.

---

## Feature 3: Cashflow Forecast Chart

**Current state:** Dashboard cashflow widget shows numbers + weekly projection table.

### Changes

1. **Area chart** — Recharts `AreaChart` showing 90-day forecast. X-axis: dates, Y-axis: balance. Green fill when positive, red when below zero. Tooltip: date, balance, inflows, outflows.

2. **Scenario overlay** — Existing cashflow scenarios shown as additional colored lines on the chart. Legend toggles scenarios on/off.

3. **Zero line** — Horizontal `ReferenceLine` at y=0.

4. **Placement** — In dashboard cashflow widget (compact) + new `/reports/cashflow` page (full-size with scenario management).

---

## Feature 4: Report Export (PDF + Excel)

**Current state:** Accounting data exports exist (Pohoda, CSV, Excel adapters). No report-specific exports.

### Changes

1. **Export buttons** — "Download PDF" and "Download Excel" (where applicable) in report page headers.

2. **PDF export** — Server action generating styled HTML report using existing `pdf-report.adapter.ts` pattern. Includes title, period, org name, summary stats, data table. Available on: Category, P&L, Remaining Work, Cashflow.

3. **Excel export** — Server action using existing `excel.adapter.ts` pattern. Summary sheet + data sheet. Available on: Category, P&L only.

4. **Implementation** — `apps/web/src/lib/actions/report-export.ts` with `exportReportPdfAction` and `exportReportExcelAction`. Client triggers via `useTransition` + Blob download.

---

## Feature 5: Report Snapshots Caching

**Current state:** `report_snapshots` table exists (org_id, report_type, period, data JSONB). Completely unused.

### Changes

1. **Cache layer** — Before generating a report, check snapshots for matching entry. If found and < 1 hour old, return cached data. Otherwise generate fresh and upsert.

2. **TTL-based invalidation** — 1-hour TTL. No explicit invalidation on data changes.

3. **Refresh button** — Refresh icon on report pages to force fresh generation. Shows "Last generated: X minutes ago" from snapshot's `generated_at`.

4. **Implementation** — `apps/web/src/lib/services/reports/report-cache.ts` with `getCachedOrGenerate(supabase, orgId, reportType, period, params, generateFn)`. Used by category and P&L API routes.

---

## Decisions Summary

| Decision | Choice |
|----------|--------|
| Chart library | Recharts (A) |
| Chart types | Focused set: bar, area, line. No pie charts (B) |
| Drill-down | Inline accordion expand (C) |
| Report export | PDF for all, Excel for financial only (C) |
| YoY comparison | Toggle on existing reports, overlaid on charts (C) |
| Caching | 1-hour TTL via report_snapshots table |
