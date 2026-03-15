# Sprint 5: Tax Compliance (Slovak) — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** One-click Slovak tax filing — VAT return finalization, KV DPH + DP DPH + DP Type B XML exports, income tax report, dynamic VAT rates from legislative rules.

**Architecture:** Monthly VAT return granularity (quarterly = aggregate 3 months). XML generators as pure functions in `lib/services/xml/`. Server actions for finalization workflow. Dynamic rates from `legislative_rules` table. New `/tax` section in sidebar.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL + RLS), TypeScript, TanStack Query, shadcn/ui

---

## Context for All Tasks

**Codebase location:** `c:/Users/david/Documents/NW/Claude setup/VEXERA`

**Key patterns:**
- Server actions: `"use server"`, use `createClient()` from `@/lib/supabase/server`, `getActiveOrgId()` from `@/lib/data/org`, return `{ error?: string }` or data
- Client components: `"use client"`, use `useSupabase()`, `useOrganization()`, `useQuery()` from TanStack
- Tables not in generated types require `as any` casts
- Install packages: `npx pnpm add` (pnpm not on PATH)
- Type-check: `cd apps/web && npx pnpm tsc --noEmit`
- Build: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA" && npx pnpm build`

**Existing infrastructure:**
- `vat_returns` table with `period_quarter` (to be migrated to `period_month`)
- `legislative_rules` table with seeded VAT rates, deadlines, filing requirements
- `vat.service.ts` — `calculateVatReturn(supabase, orgId, year, quarter)`
- `legislative.service.ts` — `getActiveVatRates()`, `getUpcomingDeadlines()`
- `packages/utils/src/vat.ts` — hardcoded `SLOVAK_VAT_RATES = [20, 10, 5, 0]`
- `packages/utils/src/tax.ts` — `calculateFreelancerTax()` with `SLOVAK_TAX_CONFIG_2025`
- `packages/types/src/index.ts` — `VatRate` type, `VatReturn` interface
- Sidebar: `apps/web/src/components/layout/sidebar.tsx` (or similar nav component)
- Invoices table has `contact_id` FK, contacts have `ic_dph` field for VAT ID

---

## Phase A: Schema + Legislative Update

### Task 1: Migration — VAT Returns Monthly + Org Filing Frequency

**Files:**
- Create: `supabase/migrations/20240101000047_vat_returns_monthly.sql`

**Step 1: Write migration**

```sql
-- Migrate vat_returns from quarterly to monthly granularity
-- Add filing_frequency to organizations

-- Add period_month column
ALTER TABLE vat_returns ADD COLUMN period_month SMALLINT;

-- Populate period_month from period_quarter (use first month of quarter)
UPDATE vat_returns SET period_month = (period_quarter - 1) * 3 + 1;

-- Make period_month NOT NULL
ALTER TABLE vat_returns ALTER COLUMN period_month SET NOT NULL;

-- Add check constraint
ALTER TABLE vat_returns ADD CONSTRAINT chk_vat_returns_month
  CHECK (period_month BETWEEN 1 AND 12);

-- Drop old unique constraint and create new one
ALTER TABLE vat_returns DROP CONSTRAINT IF EXISTS vat_returns_organization_id_period_year_period_quarter_key;
ALTER TABLE vat_returns ADD CONSTRAINT vat_returns_org_year_month_key
  UNIQUE (organization_id, period_year, period_month);

-- Drop period_quarter column
ALTER TABLE vat_returns DROP COLUMN period_quarter;

-- Add filing_frequency to organizations
ALTER TABLE organizations ADD COLUMN filing_frequency TEXT
  NOT NULL DEFAULT 'quarterly'
  CHECK (filing_frequency IN ('monthly', 'quarterly'));

-- Add index for period lookups
CREATE INDEX idx_vat_returns_period ON vat_returns(organization_id, period_year, period_month);
```

**Step 2: Commit**
```
feat(db): migrate vat_returns to monthly granularity and add filing_frequency
```

---

### Task 2: Update Legislative Rules to 2026

**Files:**
- Create: `supabase/migrations/20240101000048_legislative_rules_2026.sql`
- Modify: `packages/utils/src/vat.ts`
- Modify: `packages/utils/src/tax.ts`
- Modify: `packages/types/src/index.ts`

**Step 1: Write legislative rules update migration**

Update VAT rates, tax thresholds, and deadlines to 2026 values:
- Standard VAT: 23% (already seeded from 2025-01-01, verify)
- Reduced 1: 19% (already seeded from 2025-01-01, verify)
- Update 2026 tax deadlines if not already correct
- Update income tax thresholds if changed for 2026

**Step 2: Update hardcoded fallback rates**

In `packages/utils/src/vat.ts`:
- Change `SLOVAK_VAT_RATES` from `[20, 10, 5, 0]` to `[23, 19, 5, 0]`
- Change `DEFAULT_VAT_RATE` from `20` to `23`

In `packages/types/src/index.ts`:
- Update `VatRate` type to include `23` and `19` (check current definition)

In `packages/utils/src/tax.ts`:
- Update `SLOVAK_TAX_CONFIG_2025` to `SLOVAK_TAX_CONFIG_2026` with current rates
- Export both for backward compat, make 2026 the default

**Step 3: Commit**
```
feat(legislative): update to 2026 Slovak VAT rates and tax thresholds
```

---

### Task 3: Dynamic VAT Rate Loading

**Files:**
- Create: `apps/web/src/lib/actions/legislative.ts`
- Modify: `apps/web/src/lib/services/vat.service.ts`

**Step 1: Create legislative server actions**

Create `apps/web/src/lib/actions/legislative.ts`:

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveVatRates, getUpcomingDeadlines, getFilingRequirements } from "@/lib/services/legislative.service"

export async function getActiveVatRatesAction() {
  const supabase = await createClient()
  return getActiveVatRates(supabase, "SK")
}

export async function getUpcomingDeadlinesAction(daysAhead = 90) {
  const supabase = await createClient()
  return getUpcomingDeadlines(supabase, "SK", new Date(), daysAhead)
}

export async function getFilingRequirementsAction() {
  const supabase = await createClient()
  return getFilingRequirements(supabase, "SK")
}
```

**Step 2: Update VAT service to use dynamic rates**

Modify `vat.service.ts`:
- Read the current `calculateVatReturn` function
- Change it to accept month instead of quarter
- Use `getActiveVatRates()` from legislative service instead of hardcoded rates
- The function signature becomes: `calculateVatReturn(supabase, orgId, year, month)`
- For quarterly aggregation, call it 3 times and sum

**Step 3: Commit**
```
feat(vat): add dynamic VAT rate loading from legislative rules
```

---

## Phase B: VAT Return Finalization UI

### Task 4: VAT Return Server Actions

**Files:**
- Create: `apps/web/src/lib/actions/vat-returns.ts`

**Step 1: Create VAT return actions**

```typescript
"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { calculateVatReturn } from "@/lib/services/vat.service"

export async function computeVatReturnAction(year: number, month: number) {
  // Calls calculateVatReturn, upserts into vat_returns as draft
  // Returns the computed VAT return data
}

export async function getVatReturnsAction(year: number) {
  // Fetches all vat_returns for the org for a given year
  // Returns array of { period_month, status, vat_liability, ... }
}

export async function getVatReturnDetailAction(year: number, month: number) {
  // Fetches single vat_return with breakdown
  // Also fetches line items (invoices + documents) that contributed
}

export async function finalizeVatReturnAction(year: number, month: number) {
  // Validates: return exists, status is 'draft'
  // Updates status to 'final', sets finalized_at and finalized_by
  // Revalidates /tax/vat
}

export async function revertVatReturnAction(year: number, month: number) {
  // Validates: status is 'final' (not submitted)
  // Updates status back to 'draft', clears finalized_at/finalized_by
}

export async function markVatReturnSubmittedAction(year: number, month: number) {
  // Validates: status is 'final'
  // Updates status to 'submitted'
}
```

**Step 2: Commit**
```
feat(vat): add VAT return finalization server actions
```

---

### Task 5: VAT Returns List Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/tax/vat/page.tsx`
- Create: `apps/web/src/components/tax/vat-returns-list.tsx`

**Step 1: Create VAT returns list page**

Route: `/tax/vat`

Client component that:
- Year selector (dropdown, defaults to current year)
- Fetches VAT returns for selected year via `getVatReturnsAction(year)`
- If org's `filing_frequency` is quarterly, groups months into quarters (Q1=Jan-Mar, etc.)
- Table columns: Period, Status (badge: draft/final/submitted), Output VAT, Input VAT, Liability, Actions
- "Compute" button for periods without a return yet
- Click row to navigate to `/tax/vat/[year]/[month]`
- Shows next filing deadline from `legislative_rules` with warning badge if <14 days

**Step 2: Commit**
```
feat(tax): add VAT returns list page
```

---

### Task 6: VAT Return Detail Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/tax/vat/[year]/[month]/page.tsx`
- Create: `apps/web/src/components/tax/vat-return-detail.tsx`

**Step 1: Create VAT return detail page**

Route: `/tax/vat/[year]/[month]`

Client component showing:
- Header: "VAT Return — [Month] [Year]" with status badge
- Summary cards: Output VAT, Input VAT, Net Liability (with color: green=refund, red=payable)
- Breakdown table by rate (23%, 19%, 5%): base amount, VAT amount, for both output and input
- Line items accordion: lists invoices/documents included, with links
- Notes field (textarea, editable in draft, read-only otherwise)
- Action buttons based on status:
  - Draft: "Finalize" (with confirmation dialog)
  - Final: "Export KV DPH", "Export DP DPH", "Mark as Submitted", "Revert to Draft"
  - Submitted: read-only, "Export KV DPH", "Export DP DPH" still available

**Step 2: Commit**
```
feat(tax): add VAT return detail page with finalization workflow
```

---

## Phase C: XML Exports

### Task 7: KV DPH XML Generator

**Files:**
- Create: `apps/web/src/lib/services/xml/kv-dph.ts`
- Create: `apps/web/src/lib/actions/xml-export.ts`

**Step 1: Create KV DPH XML generator**

Pure function that takes invoice/document data and organization info, returns XML string.

`apps/web/src/lib/services/xml/kv-dph.ts`:

The KV DPH (Kontrolny Vykaz) XML structure per Slovak FS specification:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<KVDPHv2 xmlns="http://www.financnasprava.sk/KVDPHv2">
  <hlavicka>
    <dic>[DIC]</dic>
    <icDph>[IC_DPH]</icDph>
    <rok>[YEAR]</rok>
    <obdobie>[MONTH or QUARTER]</obdobie>
    <druhPriznania>R</druhPriznania> <!-- R=riadne, O=opravne, D=dodatocne -->
  </hlavicka>
  <telo>
    <A1> <!-- Issued invoices to SK VAT payers -->
      <A1Polozka>
        <A1IDDodavatela>[supplier IC_DPH]</A1IDDodavatela>
        <A1CisloFaktury>[invoice number]</A1CisloFaktury>
        <A1DatumDodaniaFaktury>[YYYY-MM-DD]</A1DatumDodaniaFaktury>
        <A1ZakladDane>[tax base]</A1ZakladDane>
        <A1SumaDane>[VAT amount]</A1SumaDane>
        <A1SadzbaDane>[rate]</A1SadzbaDane>
      </A1Polozka>
    </A1>
    <A2> <!-- Issued invoices to non-VAT payers (aggregated) -->
      <A2Polozka>
        <A2ZakladDane>[sum base]</A2ZakladDane>
        <A2SumaDane>[sum VAT]</A2SumaDane>
        <A2SadzbaDane>[rate]</A2SadzbaDane>
      </A2Polozka>
    </A2>
    <B1> <!-- Received invoices from SK VAT payers -->
      <B1Polozka>
        <B1IDDodavatela>[supplier IC_DPH]</B1IDDodavatela>
        <B1CisloFaktury>[invoice number]</B1CisloFaktury>
        <B1DatumPrijatiaFaktury>[YYYY-MM-DD]</B1DatumPrijatiaFaktury>
        <B1ZakladDane>[tax base]</B1ZakladDane>
        <B1SumaDane>[VAT amount]</B1SumaDane>
        <B1SadzbaDane>[rate]</B1SadzbaDane>
      </B1Polozka>
    </B1>
    <B2> <!-- Received invoices from non-VAT payers -->
      <B2Polozka>
        <B2ZakladDane>[sum base]</B2ZakladDane>
        <B2SumaDane>[sum VAT]</B2SumaDane>
        <B2SadzbaDane>[rate]</B2SadzbaDane>
      </B2Polozka>
    </B2>
    <C1> <!-- Credit notes issued -->
    </C1>
    <C2> <!-- Credit notes received -->
    </C2>
    <D> <!-- Summary totals -->
      <D1ZakladDaneSpolu>[total A1+A2 base]</D1ZakladDaneSpolu>
      <D1SumaDaneSpolu>[total A1+A2 VAT]</D1SumaDaneSpolu>
      <D2ZakladDaneSpolu>[total B1+B2 base]</D2ZakladDaneSpolu>
      <D2SumaDaneSpolu>[total B1+B2 VAT]</D2SumaDaneSpolu>
    </D>
  </telo>
</KVDPHv2>
```

The generator function:
```typescript
interface KvDphInput {
  organization: { dic: string; ic_dph: string }
  year: number
  month: number
  filingType: 'R' | 'O' | 'D' // riadne, opravne, dodatocne
  issuedInvoices: KvDphInvoice[]   // issued, grouped by whether recipient has IC DPH
  receivedInvoices: KvDphInvoice[] // received, grouped by whether supplier has IC DPH
  creditNotesIssued: KvDphInvoice[]
  creditNotesReceived: KvDphInvoice[]
}

export function generateKvDphXml(input: KvDphInput): string { ... }
```

**Step 2: Create XML export server actions**

`apps/web/src/lib/actions/xml-export.ts`:

```typescript
export async function exportKvDphAction(year: number, month: number) {
  // Fetch org data (dic, ic_dph)
  // Fetch invoices + documents for the period
  // Categorize into A1/A2/B1/B2/C1/C2
  // Call generateKvDphXml()
  // Return { xml: string, filename: string }
}
```

**Step 3: Commit**
```
feat(xml): add KV DPH (kontrolny vykaz) XML generator
```

---

### Task 8: DP DPH XML Generator

**Files:**
- Create: `apps/web/src/lib/services/xml/dp-dph.ts`
- Modify: `apps/web/src/lib/actions/xml-export.ts`

**Step 1: Create DP DPH XML generator**

The DP DPH (Danove Priznanie k DPH) XML structure per eDane:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<DPDPHv2 xmlns="http://www.financnasprava.sk/DPDPHv2">
  <hlavicka>
    <dic>[DIC]</dic>
    <icDph>[IC_DPH]</icDph>
    <rok>[YEAR]</rok>
    <obdobie>[MONTH or QUARTER]</obdobie>
    <druhPriznania>R</druhPriznania>
    <datumPodania>[filing date]</datumPodania>
  </hlavicka>
  <dpiDPH>
    <nazov>[company name]</nazov>
    <ulica>[street]</ulica>
    <obec>[city]</obec>
    <psc>[zip]</psc>
  </dpiDPH>
  <telo>
    <!-- OUTPUT VAT (rows 01-06) -->
    <r01>[base 23% domestic sales]</r01>
    <r01d>[VAT 23% domestic sales]</r01d>
    <r02>[base 19% domestic sales]</r02>
    <r02d>[VAT 19% domestic sales]</r02d>
    <r03>[base 5% domestic sales]</r03>
    <r03d>[VAT 5% domestic sales]</r03d>
    <r04>0</r04> <!-- EU acquisition base -->
    <r04d>0</r04d>
    <r05>0</r05> <!-- Services received from EU -->
    <r05d>0</r05d>
    <r06>0</r06> <!-- Domestic reverse charge -->
    <r06d>0</r06d>

    <!-- EXEMPT/SPECIAL (rows 07-13, default 0) -->
    <r07>0</r07> <!-- Exempt with deduction -->
    <r08>0</r08> <!-- EU supplies -->
    <r09>0</r09> <!-- Exports -->
    <r10>0</r10> <!-- Exempt without deduction -->
    <r11>0</r11> <!-- Triangular EU -->
    <r12>0</r12> <!-- Services to EU -->
    <r13>0</r13> <!-- Other exempt -->

    <!-- INPUT VAT (rows 14-20) -->
    <r14>[base 23% domestic purchases]</r14>
    <r14d>[VAT 23% deductible]</r14d>
    <r15>[base 19% domestic purchases]</r15>
    <r15d>[VAT 19% deductible]</r15d>
    <r16>[base 5% domestic purchases]</r16>
    <r16d>[VAT 5% deductible]</r16d>
    <r17>0</r17> <!-- EU acquisition input -->
    <r17d>0</r17d>
    <r18>0</r18> <!-- Import input -->
    <r18d>0</r18d>
    <r19>0</r19> <!-- Services from EU input -->
    <r19d>0</r19d>
    <r20>0</r20> <!-- Domestic reverse charge input -->
    <r20d>0</r20d>

    <!-- ADJUSTMENTS (rows 21-26, default 0) -->
    <r21>0</r21> <!-- Coefficient adjustment -->
    <r22>0</r22> <!-- Regularization -->
    <r23>0</r23> <!-- Capital goods adjustment -->
    <r24>0</r24> <!-- Correction of deduction -->
    <r25>0</r25> <!-- Correction of output -->
    <r26>0</r26> <!-- Credit note corrections -->

    <!-- TOTALS -->
    <r27>[sum output VAT: r01d+r02d+r03d+...+r06d-r25-r26]</r27>
    <r28>[sum input VAT: r14d+r15d+r16d+...+r20d+r21+r22+r23+r24]</r28>
    <r29>[r27-r28 if positive = to pay]</r29>
    <r30>[r28-r27 if positive = overpayment]</r30>
    <r31>[excess deduction to refund]</r31>
    <r32>[excess to carry forward]</r32>
    <r33>[final amount to pay]</r33>
  </telo>
</DPDPHv2>
```

Generator function:
```typescript
interface DpDphInput {
  organization: { dic: string; ic_dph: string; name: string; address_street: string; address_city: string; address_zip: string }
  year: number
  month: number
  filingType: 'R' | 'O' | 'D'
  vatReturn: VatReturnData // aggregated totals from vat_returns table
}

export function generateDpDphXml(input: DpDphInput): string { ... }
```

**Step 2: Add export action**

Add `exportDpDphAction(year, month)` to `xml-export.ts`.

**Step 3: Commit**
```
feat(xml): add DP DPH (danove priznanie) XML generator
```

---

### Task 9: DP Type B (Income Tax) XML Generator

**Files:**
- Create: `apps/web/src/lib/services/xml/dp-type-b.ts`
- Modify: `apps/web/src/lib/actions/xml-export.ts`
- Modify: `packages/utils/src/tax.ts`

**Step 1: Update tax config to 2026**

In `packages/utils/src/tax.ts`, add `SLOVAK_TAX_CONFIG_2026` alongside existing 2025 config. Update rates/thresholds per 2026 legislation.

**Step 2: Create DP Type B XML generator**

The DP Type B (Danove Priznanie k dani z prijmov FO typ B) structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<DPFOBv21 xmlns="http://www.financnasprava.sk/DPFOBv21">
  <hlavicka>
    <dic>[DIC]</dic>
    <rok>[TAX YEAR]</rok>
    <druhPriznania>R</druhPriznania>
  </hlavicka>
  <identifikacia>
    <priezvisko>[surname]</priezvisko>
    <meno>[first name]</meno>
    <ulica>[street]</ulica>
    <obec>[city]</obec>
    <psc>[zip]</psc>
    <stat>SK</stat>
  </identifikacia>
  <telo>
    <!-- Section III: Income from business §6 -->
    <r03301>[gross income from business]</r03301>
    <r03302>[expenses]</r03302>

    <!-- Section IV: Expense method -->
    <r04>[flat rate or actual]</r04>
    <r04a>[flat rate amount if applicable]</r04a>

    <!-- Section V: Tax base -->
    <r05>[partial tax base from §6]</r05>
    <r05a>[total tax base]</r05a>

    <!-- Section VI: Tax calculation -->
    <r06>[nezdanitelna ciastka]</r06>
    <r06a>[adjusted tax base]</r06a>
    <r06b>[tax at 15%/19%/25%]</r06b>

    <!-- Section VII: Final -->
    <r07>[total tax]</r07>
    <r07a>[prepayments]</r07a>
    <r07b>[to pay / refund]</r07b>

    <!-- Section VIII: Insurance base -->
    <r08>[social insurance base]</r08>
    <r08a>[health insurance base]</r08a>
  </telo>
</DPFOBv21>
```

Generator function:
```typescript
interface DpTypeBInput {
  taxpayer: { dic: string; full_name: string; address_street: string; address_city: string; address_zip: string }
  year: number
  filingType: 'R' | 'O' | 'D'
  income: number // gross income from business
  expenses: number // actual expenses
  taxRegime: 'pausalne_vydavky' | 'naklady'
  taxConfig: TaxConfig // from packages/utils/src/tax.ts
  prepayments: number // tax prepayments made during year
}

export function generateDpTypeBXml(input: DpTypeBInput): string { ... }
```

**Step 3: Add export action**

Add `exportIncomeTaxAction(year)` to `xml-export.ts`:
- Fetches YTD income from issued invoices
- Fetches YTD expenses from received invoices/documents
- Gets freelancer profile (tax regime)
- Calls `calculateFreelancerTax()` for computation
- Calls `generateDpTypeBXml()` for XML

**Step 4: Commit**
```
feat(xml): add DP Type B (income tax) XML generator for freelancers
```

---

## Phase D: Income Tax Report Page

### Task 10: Income Tax Report Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/tax/income/page.tsx`
- Create: `apps/web/src/components/tax/income-tax-report.tsx`
- Create: `apps/web/src/lib/data/income-tax.ts`

**Step 1: Create income tax data fetcher**

`apps/web/src/lib/data/income-tax.ts`:

```typescript
// Fetches YTD income, expenses, tax regime, calculates estimated tax
// Uses calculateFreelancerTax from @vexera/utils
// Returns: { income, expenses, taxRegime, estimatedTax, socialContrib, healthContrib, filingDeadline }
```

**Step 2: Create income tax report page**

Route: `/tax/income`

Client component showing:
- Year selector (defaults to current year)
- Summary cards: YTD Income, YTD Expenses, Tax Regime badge
- Tax calculation breakdown:
  - Gross income
  - Expense deduction (flat rate amount or actual)
  - Insurance deduction
  - Tax base
  - Estimated tax (with bracket breakdown: 15% / 19% / 25%)
  - Monthly contribution estimates (social + health)
- Filing deadline card with countdown/warning
- "Export DP Type B" button (calls `exportIncomeTaxAction`)
- Note: "Company income tax (DP Type A) coming soon" for non-freelancer orgs

**Step 3: Commit**
```
feat(tax): add income tax report page with DP Type B export
```

---

## Phase E: Navigation + Org Settings

### Task 11: Add Tax Section to Sidebar

**Files:**
- Modify: sidebar/nav component (find exact file first)

**Step 1: Read the current sidebar component**

Find and read the sidebar component to understand the navigation structure.

**Step 2: Add Tax navigation group**

Add a "Tax" section below Ledger in the sidebar with:
- `/tax/vat` — "VAT Returns" (icon: Receipt or Calculator)
- `/tax/income` — "Income Tax" (icon: FileText or Landmark)

**Step 3: Commit**
```
feat(nav): add Tax section to sidebar navigation
```

---

### Task 12: Add Filing Frequency to Org Settings

**Files:**
- Modify: `apps/web/src/app/(dashboard)/settings/page.tsx`

**Step 1: Read and modify org settings page**

Add a "Filing Frequency" dropdown (Monthly / Quarterly) to the organization settings form. It should:
- Read current value from `activeOrg.filing_frequency` (will need org provider to include this field)
- Save via the existing org update mechanism
- Only show for VAT payer orgs (those with `ic_dph` set)

**Step 2: Update organization provider if needed**

If `filing_frequency` is not included in the org select query in the organization provider, add it.

**Step 3: Commit**
```
feat(settings): add VAT filing frequency setting
```

---

### Task 13: Update VAT Widget with Dynamic Rates

**Files:**
- Modify: `apps/web/src/components/dashboard/vat-widget.tsx`
- Modify: `apps/web/src/lib/data/vat.ts`

**Step 1: Update VAT data layer**

Modify `apps/web/src/lib/data/vat.ts`:
- Change `getCurrentQuarterVat` to use monthly calculation
- Use dynamic rates from `legislative_rules` instead of hardcoded
- Fix the known double-counting bug (docs + invoices counted separately)

**Step 2: Update VAT widget**

- Display rates from DB (23%, 19%, 5%) instead of hardcoded (20%, 10%, 5%)
- Add link to `/tax/vat` from widget ("View VAT Returns →")

**Step 3: Commit**
```
feat(vat): update widget with dynamic rates and link to VAT returns
```

---

## Phase F: Verification

### Task 14: Type-Check and Build

**Step 1: Run type-check**

```bash
cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx pnpm tsc --noEmit
```

**Step 2: Run build**

```bash
cd "c:/Users/david/Documents/NW/Claude setup/VEXERA" && npx pnpm build
```

**Step 3: Fix any errors and commit**
```
fix: resolve type-check and build errors for sprint 5
```

---

## Summary

| Phase | Tasks | What |
|-------|-------|------|
| A | 1-3 | Migration (monthly VAT returns + filing frequency), 2026 legislative update, dynamic rates |
| B | 4-6 | VAT return server actions, list page, detail page with finalization workflow |
| C | 7-9 | KV DPH XML, DP DPH XML, DP Type B XML generators + export actions |
| D | 10 | Income tax report page |
| E | 11-13 | Sidebar navigation, org settings, VAT widget update |
| F | 14 | Type-check + build verification |
