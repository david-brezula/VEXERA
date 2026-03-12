# Vexera: Full Feature Gap Analysis & Sprint Roadmap

## Context

Vexera is a multi-tenant SaaS for invoice management, accounting, and ledger management built for the Slovak/EU market. The goal is to build a platform that surpasses all competitors (Pohoda, Money S3, iDoklad, SuperFaktura, FreshBooks, Xero, QuickBooks) by offering AI-powered automation, beautiful modern UX, full Slovak compliance, and real-time accountant collaboration -- all in one product.

Phase 0 (scaffold) is complete. Many features have real implementations but with significant gaps. This document provides a full audit of every feature area, identifies what works vs. what's missing, and proposes a prioritized sprint roadmap to reach production quality.

Approach chosen: **Core Accounting First** -- build rock-solid accounting + compliance, then layer AI and collaboration on top. Every sprint's output is made beautiful as it goes.

---

## Feature Audit Summary

### Status Legend
- **Working** = Real implementation, functional end-to-end
- **Partial** = Real code exists but with significant gaps or broken features
- **Stub** = Page exists but minimal/placeholder functionality
- **Missing** = No implementation exists

---

### 1. INVOICING

| Component | Status | What Works | Critical Gaps |
|-----------|--------|------------|---------------|
| Invoice list | Working | Filters (status, type, date, search), Suspense skeleton, real Supabase query | No pagination, no bulk actions, no sort controls, no export |
| Invoice detail | Working | Full Slovak-compliant layout, supplier/customer info, line items, tabs, status actions | History tab is stub, no credit notes, no email send, no partial payment display |
| Invoice form | Working | Full react-hook-form + Zod, 6 sections, create/edit, all Slovak fields | No contact autocomplete, no product picker, specific_symbol field missing from UI |
| Invoice print | Working | A4-width Slovak layout, supplier/customer, line items, print CSS | No company logo, no QR payment code, no multi-currency, no VAT breakdown by rate, no PDF generation (browser print only) |
| Invoice actions | Working | Status transitions (draft->sent->paid/overdue/cancelled), confirm dialogs, soft delete | No email send, no PDF download, no credit note creation, no Peppol e-invoicing |
| Invoice filters | Working | Search, status, type, date range via URL params | No debounce on search, no clear button, no amount filter |
| Invoice documents tab | Working | Upload, list, download, delete attachments | No preview, no rename |
| Recurring invoices | Partial | Template list, template table | No queue processor/cron to actually generate invoices on schedule |
| Invoice payments | Partial | DB schema exists (migration 41) | Migration likely broken (total_amount referenced but column is total), paid_amount/remaining_amount not shown in UI |
| Invoice Zod schema | Working | All fields including Slovak-specific | No cross-field validation (due_date >= issue_date) |

Biggest invoicing gaps:
1. No contact autocomplete -- customers entered as free text despite contacts table existing
2. No product picker -- line items are free text despite products table existing
3. No PDF generation -- relies on browser print
4. No QR payment code (standard on Slovak invoices)
5. No Peppol e-invoicing (columns exist in DB but completely absent from UI)
6. Invoice payments migration likely broken

---

### 2. CONTACTS

| Component | Status | What Works | Critical Gaps |
|-----------|--------|------------|---------------|
| Contacts page | Working | Full CRUD, type tabs, search, modal form, import from invoices | No link to associated invoices, no detail page, no Slovak register lookup |
| Contact form | Working | All fields (name, ICO, DIC, IC DPH, address, bank, flags) | No ICO lookup from ORSR/ZR registers |
| Contact stats | Partial | DB columns exist (total_invoiced, invoice_count, avg_payment_days) | No trigger/job to update stats |
| contact_id on invoices | Missing | N/A | Contacts and invoices are completely decoupled -- no FK relationship |

---

### 3. PRODUCTS

| Component | Status | What Works | Critical Gaps |
|-----------|--------|------------|---------------|
| Products page | Working | Full CRUD, modal form, table | No search/filter, no categories |
| Product form | Working | All fields (name, SKU, unit, price, VAT, currency) | No product detail page |
| Product stats | Partial | DB columns exist (total_revenue, times_invoiced) | Never incremented by invoice creation |
| product_id on invoice_items | Missing | N/A | Products and line items are completely decoupled -- no FK relationship |

---

### 4. DOUBLE-ENTRY LEDGER

| Component | Status | What Works | Critical Gaps |
|-----------|--------|------------|---------------|
| Ledger page | Working | Parallel data fetching, Suspense | Filters resolved client-side only (full dataset fetched always) |
| Journal tab | Working | Full table, batch posting, per-row actions, filters, stats | No pagination, no compound/multi-line entries |
| Chart of Accounts tab | Working | Searchable, grouped by Slovak classes 0-9, type badges | No add/edit account UI |
| Balances tab | Partial | Year/month selectors exist in UI | Selectors are non-functional -- never trigger server refetch |
| CoA schema | Working | Proper normalization, hierarchy support | No RLS policies, no currency field |
| Ledger entries schema | Working | Dual FK + denormalized account numbers, period columns | No RLS policies, single debit/credit per row (no compound entries) |

Biggest ledger gaps:
1. No RLS on chart_of_accounts or ledger_entries -- org data isolation relies solely on app-level filtering
2. Balances tab filter is completely broken (UI wired but never queries)
3. No compound journal entries (real accounting needs multi-line entries)
4. No period locking/closing
5. Balances computed in TypeScript by fetching all posted entries -- won't scale

---

### 5. BANK & CASH

| Component | Status | What Works | Critical Gaps |
|-----------|--------|------------|---------------|
| Bank page | Working | 3 tabs (Transactions, Import, Reconcile), account filter, match status filter | No manual "Add bank account" visible, no date filter, no export |
| Bank import | Working | BankImportWizard component exists | Not fully audited |
| Reconciliation | Working | Auto-reconciliation via mutation, suggestions panel | No summary before running |

---

### 6. DOCUMENTS & OCR

| Component | Status | What Works | Critical Gaps |
|-----------|--------|------------|---------------|
| Documents list | Working | Filters (type, search, status, date range), Suspense | No pagination |
| Document detail | Working | Status workflow, file preview (images, PDFs), metadata editing, comments, audit log, OCR data tab | Comments show raw UUID (no profile names), OCR data is raw JSON (no structured extraction UI), no link to invoice/ledger |
| Document status machine | Working | Valid transitions enforced, optimistic updates | No access control per role |

---

### 7. DASHBOARD

| Component | Status | What Works | Critical Gaps |
|-----------|--------|------------|---------------|
| Company dashboard | Working | Stat cards, financial overview, cashflow widget, VAT widget | No charts (all tables/cards), greeting not personalized |
| Financial overview | Working | Revenue/expenses/profit cards, VAT cards, 6-month trend table | No chart visualization, hardcoded 15% tax rate |
| Cashflow widget | Working | 90-day forecast, risk detection, weekly projection table | No chart, simplistic balance calc, no scenario modeling |
| VAT widget | Partial | Per-rate breakdown, quarterly trend | Double-counting bug (docs + invoices counted separately, linked ones counted twice) |
| Accountant dashboard | Working | KPI cards, client table, urgency sorting | "View" links hardcoded to /inbox, no per-client drill-down |

Critical bug: VAT widget has a double-counting risk that could produce incorrect VAT figures.

---

### 8. EXPORT

| Component | Status | What Works | Critical Gaps |
|-----------|--------|------------|---------------|
| Export page | Working | Format selection (Pohoda/Money S3/KROS/CSV), date range, job polling, download | No selective type inclusion UI, no job cancellation, actual file generation unverified |
| Export schema | Working | Full lifecycle, S3 path, row count | No file expiry tracking |

---

### 9. REPORTS

| Component | Status | What Works | Critical Gaps |
|-----------|--------|------------|---------------|
| Reports index | Working | Navigation hub to 4 sub-reports | Static links only |
| Categories report | Working | Period selector, summary cards, tabbed breakdown | No charts, no drill-down, no export |
| Client/Project P&L | Working | Shared component, margin badges, summary | No charts, no sorting, no drill-down |
| Remaining work | Working | Deadline urgency, per-client readiness | No multi-deadline support |
| Report snapshots | Partial | Schema exists | Unused by UI -- reports always compute live |

---

### 10. INBOX

| Component | Status | What Works | Critical Gaps |
|-----------|--------|------------|---------------|
| Inbox page | Working | Stat cards, tab filters, multi-select, batch approve, per-row actions | No search, no sorting, no pagination, no reject action |

---

### 11. RULES ENGINE

| Component | Status | What Works | Critical Gaps |
|-----------|--------|------------|---------------|
| Rules page | Working | Tabs, table, create/edit dialog | Action values are free-text (should be dropdowns for categories/accounts) |
| Rule form | Working | Dynamic conditions/actions builder, Zod validation | No OR logic, no test/dry-run, raw field names in selectors |
| Rules schema | Working | JSONB conditions/actions, audit log, priority index | No rule versioning |

---

### 12. SETTINGS

| Component | Status | What Works | Critical Gaps |
|-----------|--------|------------|---------------|
| Organization settings | Working | Full profile form with Slovak fields | No logo upload, no VAT status, no fiscal year, no default currency |
| Archive settings | Working | Retention policies, expiring docs list | Enforcement is back-end only |
| Billing | Stub | Placeholder text only | Zero Stripe integration |
| Members | Stub | Read-only member list | No invite, no role change, no remove |
| Email connection | Partial | Connect Gmail, show status | No disconnect, no multi-account, OAuth tokens stored as plain text |

---

### 13. ADDITIONAL FEATURES (Schema-only, no/minimal UI)

| Feature | Schema | UI | Notes |
|---------|--------|----|-------|
| Tags (client/project/custom) | Complete | Used by P&L reports | No tag management UI, no tagging UI on documents/invoices |
| Chat/AI assistant | Complete | None | chat_sessions + chat_messages tables exist, no UI |
| Email tracking | Complete | None | Outbound invoice email tracking with open pixel |
| Cashflow scenarios | Complete | None | What-if scenario modeling, no UI |
| Legislative rules | Complete + seeded | None | Slovak VAT rates, deadlines, retention periods -- reference data |
| Analytics events | Complete | None | Append-only event log |
| Job queue | Complete | None | Generic priority queue for background jobs |

---

## Critical Bugs & Security Issues

1. **VAT double-counting** -- VAT widget counts docs and invoices separately; linked items counted twice
2. **Invoice payments migration broken** -- references total_amount column that doesn't exist (total)
3. **No RLS on ledger tables** -- chart_of_accounts and ledger_entries have no row-level security
4. **OAuth tokens stored as plain text** -- email_connections stores Gmail tokens unencrypted
5. **No pagination anywhere** -- every list page fetches the entire dataset
6. **Balances tab broken** -- year/month selectors wired in UI but never query the server

---

## Proposed Sprint Roadmap

### Sprint 1: Foundation Fixes (Critical bugs + security)
Goal: Fix everything that's broken or insecure before building new features.

- Fix VAT double-counting bug in vat.ts
- Fix invoice_payments migration (total_amount -> total)
- Add RLS policies to chart_of_accounts and ledger_entries
- Encrypt OAuth tokens at app layer (or use Supabase Vault)
- Add pagination to all list pages (invoices, documents, contacts, products, ledger, inbox)
- Fix ledger balances tab to actually refetch on year/month change

### Sprint 2: Invoice Completeness
Goal: Make invoicing production-ready and competitive.

- Add contact_id FK to invoices + contact autocomplete in invoice form
- Add product_id FK to invoice_items + product picker in invoice form
- Fix specific_symbol field missing from form UI
- Add QR payment code to invoice print view (Slovak PAY by square standard)
- Add PDF generation (server-side via @react-pdf/renderer or Puppeteer)
- Add company logo support to invoice print/PDF
- Add VAT breakdown by rate in print view
- Add "Send by email" action with email tracking
- Add credit note creation (linked to original invoice)
- Add cross-field validation (due_date >= issue_date)
- Wire up contact stats update on invoice creation
- Wire up product stats update on invoice creation

### Sprint 3: Ledger & Accounting Engine
Goal: Make the ledger production-ready for professional accountants.

- Add compound/multi-line journal entries (journal_entry_id grouping)
- Add chart of accounts management UI (add/edit/deactivate accounts)
- Move balance computation to SQL aggregates (not TypeScript full-scan)
- Add period locking/closing functionality
- Surface invoice_id / document_id links in ledger entries
- Add automatic posting of invoices to ledger
- Server-side filtering for ledger (not client-side full dataset fetch)

### Sprint 4: Member Management & Collaboration
Goal: Enable real team usage.

- Members page: invite, role change, remove functionality
- Invitation flow (connect to existing invitations table)
- Role-based access control in UI (accountant vs. owner vs. member views)
- Accountant dashboard: per-client drill-down (not hardcoded /inbox links)
- Activity audit log on invoice detail (History tab)

### Sprint 5: Tax Compliance (Slovak)
Goal: One-click Slovak tax filing support.

- VAT return finalization UI (draft -> final -> submitted workflow)
- KV DPH (kontrolny vykaz) XML export
- DP DPH (danove priznanie) XML export for eDane portal
- Monthly VAT filer support (not just quarterly)
- Income tax report helpers
- Integration with legislative_rules reference data

### Sprint 6: PDF Generation & E-invoicing
Goal: Professional document output and EU compliance.

- Server-side PDF generation for invoices
- Peppol e-invoicing support (UBL/CII format)
- Invoice email sending with tracking (use email_tracking schema)
- Recurring invoice cron job (use job_queue + recurring_invoice_templates)

### Sprint 7: Smart Automation
Goal: AI-powered features that differentiate from competitors.

- OCR structured extraction UI (not just raw JSON display)
- Rule engine improvements (OR logic, dropdown values, test/dry-run)
- Auto-categorization suggestions
- Recurring pattern auto-detection from bank transactions
- Chat/AI assistant UI (use existing chat_sessions schema)

### Sprint 8: Reports & Analytics
Goal: Comprehensive business intelligence.

- Chart visualizations for all reports (revenue, expenses, P&L, cashflow)
- Report drill-down (click category -> see underlying documents)
- Report export (PDF/Excel)
- Use report_snapshots for caching (currently unused)
- Cashflow scenario modeling UI (use existing schema)
- Year-over-year comparisons

### Sprint 9: Polish & Scale
Goal: Production hardening.

- Search debounce on all filter inputs
- Tag management UI + inline tagging on documents/invoices
- Settings: logo upload, VAT status, fiscal year, default currency
- Billing/subscription integration (Stripe)
- Scheduled health checks (not just manual)
- Performance optimization (SQL aggregates, pagination, caching)

---

## Verification

After each sprint:
1. Run pnpm type-check -- no TypeScript errors
2. Run pnpm build -- successful production build
3. Run pnpm lint -- no linting errors
4. Manual test the affected flows end-to-end in the browser
5. Verify RLS by testing cross-org data isolation
6. For DB migrations: test on a fresh supabase db push

---

## Key Files Reference

| Area | Critical Files |
|------|---------------|
| Invoice form | apps/web/src/components/invoices/invoice-form.tsx |
| Invoice actions | apps/web/src/components/invoices/invoice-actions.tsx |
| Invoice print | apps/web/src/app/(dashboard)/invoices/[id]/print/page.tsx |
| Invoice schema | apps/web/src/lib/validations/invoice.schema.ts |
| Ledger client | apps/web/src/components/ledger/ledger-client.tsx |
| VAT data (bug) | apps/web/src/lib/data/vat.ts |
| Cashflow data | apps/web/src/lib/data/cashflow.ts |
| Dashboard | apps/web/src/app/(dashboard)/dashboard/page.tsx |
| Members page | apps/web/src/app/(dashboard)/settings/members/page.tsx |
| Email connection | apps/web/src/components/settings/email-connection.tsx |
| DB migrations | supabase/migrations/ |
| Shared utils | packages/utils/src/vat.ts, packages/utils/src/currency.ts |
| Shared types | packages/types/ |
