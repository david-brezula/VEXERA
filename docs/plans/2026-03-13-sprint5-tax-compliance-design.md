# Sprint 5: Tax Compliance (Slovak) — Design

## Decisions

- **VAT rates:** Dynamic from `legislative_rules` DB, updated to 2026 Slovak legislation
- **XML exports:** Full production XML matching eDane portal specs exactly
- **Monthly/quarterly:** Always store by month; quarterly filers aggregate 3 months
- **Income tax:** Full DP Type B XML for freelancers; company DP Type A deferred

---

## 1. Legislative Rules Update + Dynamic VAT Rates

### Migration
Update `legislative_rules` seed data to 2026 Slovak legislation:
- VAT standard: 23% (from 2025-01-01)
- VAT reduced 1: 19% (from 2025-01-01)
- VAT reduced 2: 5% (unchanged)
- VAT zero: 0%
- Update tax deadlines to 2026 calendar
- Update income tax brackets/thresholds to 2026 values

### Dynamic Rate Loading
- New `getActiveVatRatesAction()` server action calling `legislative.service.getActiveVatRates()`
- Replace hardcoded `[20, 10, 5, 0]` in `packages/utils/src/vat.ts` with `DEFAULT_VAT_RATES = [23, 19, 5, 0]` (fallback only)
- Components that need rates (invoice items editor, VAT widget, VAT return page) fetch from DB
- `vat.service.calculateVatReturn()` uses DB rates instead of hardcoded

---

## 2. VAT Return Finalization UI

### Schema Changes
- Modify `vat_returns`: replace `period_quarter` with `period_month` (SMALLINT 1-12)
- Add `filing_frequency` column to organizations: `'monthly' | 'quarterly'` (default `'quarterly'`)
- Quarterly returns = computed aggregation of 3 monthly rows

### VAT Returns Page (new route: `/tax/vat`)

**List view:**
- Table of VAT return periods (months or quarters based on org's filing frequency)
- Columns: period, status badge (draft/final/submitted), VAT liability, action buttons
- Auto-compute draft on first view (calls `calculateVatReturn` per month)

**Detail view (click into a period):**
- Summary card: output VAT, input VAT, net liability
- Breakdown table by VAT rate (23%, 19%, 5%)
- Line items section: invoices/documents included in the return
- Notes field (editable in draft)

### Status Workflow
- **Draft** -> "Finalize" -> confirmation dialog -> status = `final`, records `finalized_at`/`finalized_by`
- **Final** -> "Export KV DPH" and "Export DP DPH" buttons -> downloads XML
- **Final** -> "Mark as Submitted" -> status = `submitted`
- **Final** -> "Revert to Draft" (if not yet submitted) -> back to draft

### Server Actions
- `finalizeVatReturnAction(year, month)`
- `revertVatReturnAction(year, month)`
- `markVatReturnSubmittedAction(year, month)`

---

## 3. KV DPH (Kontrolny Vykaz) XML Export

Quarterly/monthly control statement listing all VAT-relevant transactions.

### XML Structure (per Slovak FS spec)
- Header: IC DPH, period, filing type (riadne/opravne/dodatocne)
- **Section A.1:** Issued invoices where recipient is SK VAT payer
- **Section A.2:** Issued invoices where recipient is NOT VAT payer
- **Section B.1:** Received invoices from SK VAT payer
- **Section B.2:** Received invoices from non-VAT payer
- **Section C.1/C.2:** Corrections and credit notes
- **Section D:** Summary totals per section

### Data Source
Invoices + documents for the period, categorized by:
- Direction (issued vs received)
- Whether counterparty has IC DPH
- Whether it's a credit note

### Implementation
- `apps/web/src/lib/services/xml/kv-dph.ts` — builds XML from invoice/document data
- Server action: `exportKvDphAction(year, month)` -> returns XML download
- Button on finalized VAT return detail page

---

## 4. DP DPH (Danove Priznanie) XML Export

The actual VAT tax return form (~70 line items).

### XML Structure (per Slovak FS spec)
- Header: taxpayer identification (IC DPH, DIC, name, address), period, filing type
- **Rows 01-06:** Output VAT by rate and transaction type
- **Rows 07-13:** Exempt supplies, EU supplies, exports
- **Rows 14-20:** Input VAT by rate and transaction type
- **Rows 21-26:** VAT adjustments, corrections, coefficient
- **Row 27:** Total output VAT
- **Row 28:** Total input VAT
- **Rows 29-33:** Net liability, overpayment, amount to pay/refund

### Data Mapping
- Core domestic rows (01-06, 14-20, 27-33) populated from `vat_returns` aggregated data
- EU/special rows default to 0 (extendable later)

### Implementation
- `apps/web/src/lib/services/xml/dp-dph.ts` — builds full XML per eDane schema
- Server action: `exportDpDphAction(year, month)`
- Button on finalized VAT return detail page

---

## 5. Income Tax Report + DP Type B XML

### Report Page (`/tax/income`)

**Dashboard view:**
- YTD income (from issued invoices)
- YTD expenses (from received invoices + documents)
- Tax regime indicator (pausalne vydavky / skutocne naklady)
- Estimated tax liability (using `calculateFreelancerTax`)
- Social & health contribution estimates
- Filing deadline from `legislative_rules`

### DP Type B XML (freelancer income tax return)
- Header: taxpayer info (name, address, DIC, RC)
- **Section III:** Income from business
- **Section IV:** Expense deduction (flat rate or actual)
- **Section V:** Tax base calculation
- **Section VI:** Tax computation (brackets: 15%, 19%, 25%)
- **Section VII:** Tax bonuses, prepayments, final liability
- **Section VIII:** Social/health insurance base

### Data Sources
- Invoices table (YTD issued = income)
- Documents/received invoices (YTD expenses)
- `freelancer_profiles` (tax regime)
- `packages/utils/src/tax.ts` (calculation engine — update to 2026 rates)
- `legislative_rules` (deadlines, thresholds)

### Implementation
- `apps/web/src/lib/services/xml/dp-type-b.ts` — builds XML
- Server action: `exportIncomeTaxAction(year)`
- Update `packages/utils/src/tax.ts` to 2026 rates
- New page: `apps/web/src/app/(dashboard)/tax/income/page.tsx`

Company income tax (DP Type A) deferred.

---

## 6. Organization Tax Settings + Navigation

### Organization Table
- Migration adds `filing_frequency`: `'monthly' | 'quarterly'` (default `'quarterly'`)
- Surfaced in org settings page as dropdown

### Navigation
- New `/tax` section in sidebar:
  - `/tax/vat` — VAT returns list + finalization
  - `/tax/income` — Income tax report + DP Type B export
- Sidebar gets "Tax" group below Ledger

### Deadline Awareness
- VAT returns page shows next filing deadline from `legislative_rules`
- Warning badge when deadline is within 14 days
- Income tax page shows annual deadline

### Not in Sprint 5
- eDane API direct submission (users download XML, upload manually)
- Company income tax (DP Type A)
- EU summary statement (Suhrnny vykaz)
- VAT coefficient calculation
