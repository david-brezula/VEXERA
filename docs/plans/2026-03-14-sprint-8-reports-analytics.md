# Sprint 8: Reports & Analytics — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Recharts visualizations, inline drill-down, period comparison, PDF/Excel report export, and snapshot caching to VEXERA's existing reports.

**Architecture:** Extend existing report pages (category, P&L, cashflow) with chart components, accordion drill-down rows, comparison toggle fetching a second period, export server actions, and a cache layer using the existing `report_snapshots` table.

**Tech Stack:** Recharts, Next.js 15+ (App Router), Supabase, TypeScript, TanStack Query, shadcn/ui.

**Verification:** After each task: `cd apps/web && npx tsc --noEmit`. After all tasks: `npx pnpm build`.

---

## Phase A: Foundation + Category Report Charts

### Task 1: Install Recharts + create shared chart wrapper

**Files:**
- Modify: `apps/web/package.json` — add recharts dependency
- Create: `apps/web/src/components/charts/chart-wrapper.tsx` — shared responsive container

**Step 1: Install Recharts**

```bash
cd apps/web && npx pnpm add recharts
```

**Step 2: Create chart wrapper component**

Create `apps/web/src/components/charts/chart-wrapper.tsx`:

```typescript
"use client"

import { ResponsiveContainer } from "recharts"

interface ChartWrapperProps {
  children: React.ReactNode
  height?: number
}

export function ChartWrapper({ children, height = 350 }: ChartWrapperProps) {
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {children as React.ReactElement}
      </ResponsiveContainer>
    </div>
  )
}
```

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(charts): install recharts and create shared chart wrapper"`

---

### Task 2: Category breakdown bar chart

**Files:**
- Create: `apps/web/src/components/charts/category-bar-chart.tsx`
- Modify: `apps/web/src/components/reports/categories-page-client.tsx` — add chart above table

**Step 1: Create category bar chart component**

Create `apps/web/src/components/charts/category-bar-chart.tsx`:

A `"use client"` component that:
- Props: `data: { category: string; totalAmount: number }[]`, `type: "expenses" | "revenue"`, `comparisonData?: { category: string; totalAmount: number }[]`
- Renders a horizontal `BarChart` with top 10 categories
- Uses `Bar` + `XAxis` + `YAxis` + `Tooltip` + `CartesianGrid` from recharts
- Colors: expenses = `#ef4444` (red-500), revenue = `#3b82f6` (blue-500)
- When `comparisonData` is provided, shows grouped bars with previous period in lighter colors (`#fca5a5` / `#93c5fd`)
- Custom tooltip showing category name, current amount, and comparison amount (if present)
- Import `ChartWrapper` for responsive container
- Format amounts with `formatEur` from `@vexera/utils`

**Step 2: Integrate into category report page**

In `categories-page-client.tsx`:
- Import `CategoryBarChart`
- Render the chart between the summary cards and the tabs/table
- Pass `expensesByCategory` or `revenueByCategory` based on active tab
- When comparison is active, pass `comparisonData` from the comparison report

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(charts): add category breakdown bar chart to report page"`

---

### Task 3: Compare toggle for category report

**Files:**
- Modify: `apps/web/src/components/reports/categories-page-client.tsx` — add compare switch + fetch previous period
- Modify: `apps/web/src/components/reports/category-table.tsx` — add "Previous" and "Change" columns when comparing

**Step 1: Add comparison state and data fetching**

In `categories-page-client.tsx`:
- Add state: `isComparing: boolean`, `comparisonData: CategoryBreakdown | null`
- Add a `Switch` component from shadcn in the report header area labeled "Compare with previous period"
- When toggled on, calculate the equivalent previous period:
  - If period is Q1 2026 (Jan-Mar), previous = Q1 2025 (Jan-Mar)
  - Simple: shift both `from` and `to` back by the period length
- Fetch the comparison data from `/api/reports/category` with the previous period dates
- Pass `comparisonData` to both chart and table components

**Step 2: Update category table for comparison**

In `category-table.tsx`:
- Add optional `comparisonRows` prop: `CategoryBreakdownRow[]`
- When provided, add two extra columns: "Previous" (formatted amount) and "Change" (percentage delta with arrow icon)
- Green up arrow for increase, red down arrow for decrease
- Match comparison rows to current rows by category name

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(reports): add period comparison toggle to category report"`

---

### Task 4: Inline drill-down for category table

**Files:**
- Modify: `apps/web/src/components/reports/category-table.tsx` — make rows expandable
- Create: `apps/web/src/lib/actions/report-drilldown.ts` — server action to fetch documents by IDs

**Step 1: Server action for drill-down data**

Create `apps/web/src/lib/actions/report-drilldown.ts`:

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"

export async function getDrilldownDocumentsAction(
  documentIds: string[]
): Promise<{ id: string; name: string; issue_date: string | null; total_amount: number | null; status: string; document_type: string }[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId || documentIds.length === 0) return []

  const { data } = await supabase
    .from("documents")
    .select("id, name, issue_date, total_amount, status, document_type")
    .eq("organization_id", orgId)
    .in("id", documentIds.slice(0, 50))
    .order("issue_date", { ascending: false })

  return (data ?? []) as any[]
}

export async function getDrilldownInvoicesAction(
  category: string,
  periodFrom: string,
  periodTo: string
): Promise<{ id: string; invoice_number: string; customer_name: string; issue_date: string; total_amount: number; status: string }[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []

  const { data } = await supabase
    .from("invoices")
    .select("id, invoice_number, customer_name, issue_date, total_amount, status")
    .eq("organization_id", orgId)
    .gte("issue_date", periodFrom)
    .lte("issue_date", periodTo)
    .limit(50)

  return (data ?? []) as any[]
}
```

**Step 2: Make category table rows expandable**

In `category-table.tsx`:
- Add `expandedCategory` state tracking which category row is expanded
- On row click, toggle expanded state
- When expanded, call `getDrilldownDocumentsAction(row.documentIds)` and render a sub-table within a `Collapsible` area below the row
- Sub-table shows: Name/Number, Date, Amount, Status
- Use `ChevronRight` / `ChevronDown` icon to indicate expandable state
- Loading state with skeleton while fetching
- Pass `periodFrom` and `periodTo` props for invoice drill-down context

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(reports): add inline drill-down to category table rows"`

---

## Phase B: P&L Report Charts

### Task 5: P&L bar chart + comparison + drill-down

**Files:**
- Create: `apps/web/src/components/charts/pl-bar-chart.tsx`
- Modify: `apps/web/src/components/reports/pl-page-client.tsx` — add chart, compare toggle, accordion drill-down

**Step 1: Create P&L bar chart**

Create `apps/web/src/components/charts/pl-bar-chart.tsx`:

A `"use client"` component that:
- Props: `data: { name: string; revenue: number; expenses: number }[]`, `comparisonData?: same type`
- Renders a grouped `BarChart` with revenue (green `#22c55e`) and expenses (red `#ef4444`) bars per entity
- When `comparisonData` provided, adds lighter comparison bars
- Top 10 entities shown
- Custom tooltip with entity name, revenue, expenses, profit (calculated)
- Uses `ChartWrapper` for responsive container

**Step 2: Integrate into P&L page**

In `pl-page-client.tsx`:
- Add chart between summary cards and table
- Map `PLReport[]` to chart data format: `{ name: entityName, revenue: totalRevenue, expenses: totalExpenses }`
- Add compare toggle (same pattern as category report — `Switch`, fetch previous period, pass to chart/table)
- Make table rows expandable: click → accordion shows `revenue: PLRow[]` and `expenses: PLRow[]` breakdown with category, amount, count columns

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(reports): add P&L bar chart with comparison and drill-down"`

---

## Phase C: Cashflow Forecast Chart

### Task 6: Cashflow area chart on dashboard

**Files:**
- Create: `apps/web/src/components/charts/cashflow-area-chart.tsx`
- Modify: `apps/web/src/components/dashboard/cashflow-widget.tsx` — add chart above projection table

**Step 1: Create cashflow area chart**

Create `apps/web/src/components/charts/cashflow-area-chart.tsx`:

A `"use client"` component that:
- Props: `forecast: { date: string; balance: number; inflows: number; outflows: number }[]`, `scenarios?: { name: string; color: string; points: { date: string; balance: number }[] }[]`
- Renders an `AreaChart` with:
  - X-axis: dates (formatted as dd.MM)
  - Y-axis: EUR amounts
  - Main forecast line as `Area` with gradient fill (green above zero, red below)
  - `ReferenceLine` at y=0 (dashed, gray)
  - Scenario lines as additional `Line` components with their colors
  - Custom tooltip showing date, balance, inflows, outflows
  - `Legend` showing "Forecast" + scenario names (clickable to toggle visibility)
- Uses `ChartWrapper` with height 300

**Step 2: Integrate into dashboard cashflow widget**

In `cashflow-widget.tsx`:
- Import `CashflowAreaChart`
- Render chart above the existing weekly projection table
- Map existing forecast data to the chart format
- If scenario data is available from the existing `cashflow-scenarios.service.ts`, pass it as `scenarios` prop
- Keep the existing table below the chart for detailed numbers

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(charts): add cashflow area chart with scenario overlay to dashboard"`

---

### Task 7: Dedicated cashflow report page

**Files:**
- Create: `apps/web/src/app/(dashboard)/reports/cashflow/page.tsx`
- Create: `apps/web/src/components/reports/cashflow-page-client.tsx`
- Modify: `apps/web/src/app/(dashboard)/reports/page.tsx` — add cashflow link to reports landing
- Modify: `apps/web/src/components/layout/sidebar.tsx` — add Cashflow to reports nav (if applicable)

**Step 1: Create cashflow report page**

Create `apps/web/src/app/(dashboard)/reports/cashflow/page.tsx` as a server component wrapper.

Create `apps/web/src/components/reports/cashflow-page-client.tsx`:

A `"use client"` component that:
- Fetches cashflow forecast data (reuse existing `getCashFlowData` or similar from `lib/data/cashflow.ts`)
- Fetches cashflow scenarios via existing service
- Renders summary cards: Current Balance, 30-day Forecast, 60-day Forecast, 90-day Forecast, Risk Date
- Renders full-size `CashflowAreaChart` (height 450) with all scenarios
- Below chart: scenario management section
  - List existing scenarios with name, color, adjustments summary
  - "Add Scenario" button → simple form (name, color, adjustment type, amount, date)
  - Uses existing CRUD from `cashflow-scenarios.service.ts`
- Below scenarios: weekly projection table (reuse from dashboard)

**Step 2: Add to reports landing page**

In `reports/page.tsx`, add a card/link for "Cashflow Forecast" pointing to `/reports/cashflow`.

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(reports): add dedicated cashflow report page with scenario management"`

---

## Phase D: Report Exports

### Task 8: Report PDF export

**Files:**
- Create: `apps/web/src/lib/actions/report-export.ts` — PDF export server actions
- Modify: `apps/web/src/components/reports/categories-page-client.tsx` — add PDF download button
- Modify: `apps/web/src/components/reports/pl-page-client.tsx` — add PDF download button
- Modify: `apps/web/src/components/reports/remaining-work-page-client.tsx` — add PDF download button
- Modify: `apps/web/src/components/reports/cashflow-page-client.tsx` — add PDF download button

**Step 1: Create PDF export server actions**

Create `apps/web/src/lib/actions/report-export.ts`:

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { generateCategoryReport } from "@/lib/services/reports/category-report.service"
import { generateAllTagsPLSummary } from "@/lib/services/reports/client-project-pl.service"

export async function exportCategoryReportPdfAction(
  periodFrom: string,
  periodTo: string,
  currency?: string
): Promise<{ html: string; filename: string } | { error: string }> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const report = await generateCategoryReport(supabase, orgId, { from: periodFrom, to: periodTo }, currency)

  // Get org name for header
  const { data: org } = await supabase
    .from("organizations")
    .select("name")
    .eq("id", orgId)
    .single()

  const orgName = (org as any)?.name ?? "Organization"

  const html = buildReportHtml({
    title: "Category Breakdown Report",
    orgName,
    periodFrom,
    periodTo,
    summary: [
      { label: "Total Revenue", value: formatAmount(report.totalRevenue) },
      { label: "Total Expenses", value: formatAmount(report.totalExpenses) },
      { label: "Profit", value: formatAmount(report.totalRevenue - report.totalExpenses) },
    ],
    sections: [
      {
        title: "Expenses by Category",
        headers: ["Category", "Amount", "Count", "%"],
        rows: report.expensesByCategory.map(r => [r.category, formatAmount(r.totalAmount), String(r.transactionCount), `${r.percentage.toFixed(1)}%`]),
      },
      {
        title: "Revenue by Category",
        headers: ["Category", "Amount", "Count", "%"],
        rows: report.revenueByCategory.map(r => [r.category, formatAmount(r.totalAmount), String(r.transactionCount), `${r.percentage.toFixed(1)}%`]),
      },
    ],
  })

  return { html, filename: `category-report-${periodFrom}-${periodTo}.html` }
}
```

Add similar functions:
- `exportPLReportPdfAction(periodFrom, periodTo, tagType, currency?)` — P&L report
- `exportCashflowReportPdfAction()` — Cashflow summary
- `exportRemainingWorkReportPdfAction(organizationIds)` — Remaining work

Create a shared `buildReportHtml` helper function that generates styled HTML with:
- Print-friendly CSS (A4 width, page breaks)
- Organization name, report title, period
- Summary cards row
- Data tables with zebra striping
- Footer with generation date

Create a shared `formatAmount` helper that formats numbers as EUR currency.

**Step 2: Add PDF download buttons to report pages**

On each report page, add a `Button variant="outline" size="sm"` with `DownloadIcon` labeled "PDF" in the header area. On click:
- Use `useTransition` for loading state
- Call the export action
- Create a Blob from the returned HTML
- Open in new window for browser print/save-as-PDF

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(reports): add PDF export to all report pages"`

---

### Task 9: Report Excel export

**Files:**
- Modify: `apps/web/src/lib/actions/report-export.ts` — add Excel export actions
- Modify: `apps/web/src/components/reports/categories-page-client.tsx` — add Excel download button
- Modify: `apps/web/src/components/reports/pl-page-client.tsx` — add Excel download button

**Step 1: Add Excel export server actions**

Add to `report-export.ts`:

```typescript
export async function exportCategoryReportExcelAction(
  periodFrom: string,
  periodTo: string,
  currency?: string
): Promise<{ base64: string; filename: string } | { error: string }> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const report = await generateCategoryReport(supabase, orgId, { from: periodFrom, to: periodTo }, currency)

  // Use existing ExcelAdapter pattern or build CSV
  // Build CSV content with headers and rows
  const rows: string[][] = [
    ["Category", "Amount", "Count", "Percentage", "Type"],
    ...report.expensesByCategory.map(r => [r.category, String(r.totalAmount), String(r.transactionCount), `${r.percentage.toFixed(1)}%`, "Expense"]),
    ...report.revenueByCategory.map(r => [r.category, String(r.totalAmount), String(r.transactionCount), `${r.percentage.toFixed(1)}%`, "Revenue"]),
  ]

  const csv = rows.map(r => r.map(c => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n")
  const base64 = Buffer.from(csv, "utf-8").toString("base64")

  return { base64, filename: `category-report-${periodFrom}-${periodTo}.csv` }
}
```

Add similar `exportPLReportExcelAction` for P&L.

Note: If the existing `excel.adapter.ts` can be reused for proper .xlsx generation, use it. Otherwise CSV is acceptable for accountant use cases.

**Step 2: Add Excel download buttons**

On Category and P&L report pages, add a second button "Excel" with `TableIcon` next to the PDF button. On click:
- Call the export action
- Decode base64, create Blob, trigger download

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(reports): add Excel export to category and P&L reports"`

---

## Phase E: Report Snapshots Caching

### Task 10: Report cache layer

**Files:**
- Create: `apps/web/src/lib/services/reports/report-cache.ts`
- Modify: `apps/web/src/app/api/reports/category/route.ts` — wrap with cache
- Modify: `apps/web/src/app/api/reports/client-pl/route.ts` — wrap with cache

**Step 1: Create cache utility**

Create `apps/web/src/lib/services/reports/report-cache.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js"

const CACHE_TTL_MS = 60 * 60 * 1000  // 1 hour

type ReportType = "category_breakdown" | "client_pl" | "project_pl" | "remaining_work"

export async function getCachedOrGenerate<T>(
  supabase: SupabaseClient,
  organizationId: string,
  reportType: ReportType,
  periodFrom: string,
  periodTo: string,
  params: Record<string, unknown>,
  generateFn: () => Promise<T>,
  options?: { skipCache?: boolean }
): Promise<{ data: T; cached: boolean; generatedAt: string }> {
  if (!options?.skipCache) {
    // Check for cached snapshot
    const { data: snapshot } = await supabase
      .from("report_snapshots")
      .select("data, generated_at")
      .eq("organization_id", organizationId)
      .eq("report_type", reportType)
      .eq("period_from", periodFrom)
      .eq("period_to", periodTo)
      .order("generated_at", { ascending: false })
      .limit(1)
      .single()

    if (snapshot) {
      const age = Date.now() - new Date((snapshot as any).generated_at).getTime()
      if (age < CACHE_TTL_MS) {
        return {
          data: (snapshot as any).data as T,
          cached: true,
          generatedAt: (snapshot as any).generated_at,
        }
      }
    }
  }

  // Generate fresh
  const data = await generateFn()
  const generatedAt = new Date().toISOString()

  // Upsert snapshot (fire-and-forget)
  await (supabase.from("report_snapshots" as any) as any)
    .upsert(
      {
        organization_id: organizationId,
        report_type: reportType,
        period_from: periodFrom,
        period_to: periodTo,
        parameters: params,
        data,
        generated_at: generatedAt,
      },
      { onConflict: "organization_id,report_type,period_from" }
    )
    .select()

  return { data, cached: false, generatedAt }
}
```

Note: The upsert may need adjustment depending on the table's unique constraints. If no unique constraint exists, use delete + insert pattern instead.

**Step 2: Wrap category report API with cache**

In `apps/web/src/app/api/reports/category/route.ts`:
- Import `getCachedOrGenerate`
- Wrap the `generateCategoryReport` call with the cache
- Pass `skipCache: true` when a `refresh=true` query param is present
- Include `cached` and `generatedAt` in the API response

**Step 3: Wrap P&L report API with cache**

Same pattern in `apps/web/src/app/api/reports/client-pl/route.ts`.

**Step 4: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 5: Commit** — `git add -A && git commit -m "feat(reports): add snapshot caching layer for category and P&L reports"`

---

### Task 11: Refresh button on report pages

**Files:**
- Modify: `apps/web/src/components/reports/categories-page-client.tsx` — add refresh button + "last generated" text
- Modify: `apps/web/src/components/reports/pl-page-client.tsx` — same
- Modify: `apps/web/src/hooks/use-reports.ts` — pass refresh param, expose generatedAt

**Step 1: Update hooks to support refresh and expose cache metadata**

In `use-reports.ts`:
- Add `refresh` param to the query key and fetch URL
- Include `cached` and `generatedAt` in the return type
- Add a `refetch` function that passes `refresh=true`

**Step 2: Add refresh UI to report pages**

On category and P&L pages:
- Add a `RefreshCw` icon button next to the period selector
- On click, refetch with `refresh=true` to bypass cache
- Show "Last generated: X minutes ago" text in muted style next to the refresh button
- Format the time as relative (e.g., "2 minutes ago", "1 hour ago")

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(reports): add refresh button and cache timestamp to report pages"`

---

## Verification

After all tasks:

```bash
cd apps/web && npx tsc --noEmit     # Type check
cd apps/web && npx pnpm build       # Full build
cd apps/web && npx pnpm lint        # Lint check
```

Fix any errors before marking Sprint 8 complete.
