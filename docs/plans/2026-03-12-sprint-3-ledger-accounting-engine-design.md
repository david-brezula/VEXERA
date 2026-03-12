# Sprint 3: Ledger & Accounting Engine — Design Document

## Context

Sprint 2 made invoicing production-ready (contact/product pickers, PDF generation, QR codes, credit notes, email). Sprint 3 makes the ledger production-ready for professional accountants by adding compound journal entries, automatic invoice posting, SQL-based balance computation, chart of accounts management, and fiscal period locking.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Compound entries | New `journal_entries` parent table | Cleaner data model, proper relational structure |
| Invoice posting trigger | On invoice creation (as draft) | Lets accountants review before posting |
| Account mapping | Org-level defaults with Slovak fallbacks | Covers 90% of cases, configurable per org |
| Period locking granularity | Monthly + quarterly convenience | Monthly is standard for Slovak accounting; quarterly is a batch lock of 3 months |

---

## 1. Schema Changes

### New table: `journal_entries`

Parent table for compound/multi-line ledger entries.

```
journal_entries
├── id UUID PK DEFAULT gen_random_uuid()
├── organization_id UUID NOT NULL FK → organizations ON DELETE CASCADE
├── entry_number TEXT NOT NULL (auto-generated, e.g. "JE-2026-0001")
├── entry_date DATE NOT NULL
├── period_year SMALLINT GENERATED ALWAYS AS EXTRACT(YEAR FROM entry_date)
├── period_month SMALLINT GENERATED ALWAYS AS EXTRACT(MONTH FROM entry_date)
├── description TEXT NOT NULL
├── reference_number TEXT (nullable — invoice number, doc ref)
├── invoice_id UUID FK → invoices ON DELETE SET NULL
├── document_id UUID FK → documents ON DELETE SET NULL
├── status TEXT CHECK (status IN ('draft','posted','reversed')) DEFAULT 'draft'
├── is_closing_entry BOOLEAN DEFAULT FALSE
├── reversed_by UUID FK → journal_entries (self-ref)
├── created_by UUID FK → profiles
├── posted_by UUID FK → profiles
├── posted_at TIMESTAMPTZ
├── created_at TIMESTAMPTZ DEFAULT NOW()
├── updated_at TIMESTAMPTZ DEFAULT NOW()
```

Indexes: organization_id, entry_date, (period_year, period_month), invoice_id, status.

RLS: Same pattern as current ledger_entries (accessible_organization_ids for SELECT/INSERT, draft-only for UPDATE/DELETE).

### Refactored `ledger_entries` (becomes journal entry line items)

Add columns:
- `journal_entry_id UUID FK → journal_entries NOT NULL` (for new entries)
- `account_id UUID FK → chart_of_accounts`
- `account_number TEXT` (denormalized)
- `debit_amount DECIMAL(15,2) DEFAULT 0`
- `credit_amount DECIMAL(15,2) DEFAULT 0`

Remove columns (moved to journal_entries):
- `debit_account_id`, `credit_account_id`, `debit_account_number`, `credit_account_number`
- `invoice_id`, `document_id`
- `status`, `is_closing_entry`, `reversed_by`
- `description`, `reference_number`, `entry_date`, `period_year`, `period_month`

Check constraint on journal_entries: sum(debit_amount) = sum(credit_amount) across child ledger_entries (enforced at application level, not DB trigger — Supabase limitation).

### Migration strategy for existing data

Each existing `ledger_entry` row becomes:
1. One `journal_entry` (inheriting date, description, reference, invoice_id, document_id, status, etc.)
2. Two `ledger_entries` lines:
   - Line 1: debit_amount = original.amount, credit_amount = 0, account = original.debit_account
   - Line 2: debit_amount = 0, credit_amount = original.amount, account = original.credit_account

### New table: `fiscal_periods`

```
fiscal_periods
├── id UUID PK DEFAULT gen_random_uuid()
├── organization_id UUID NOT NULL FK → organizations ON DELETE CASCADE
├── year SMALLINT NOT NULL
├── month SMALLINT NOT NULL
├── status TEXT CHECK (status IN ('open','locked','archived')) DEFAULT 'open'
├── locked_at TIMESTAMPTZ
├── locked_by UUID FK → profiles
├── created_at TIMESTAMPTZ DEFAULT NOW()
├── UNIQUE(organization_id, year, month)
```

RLS: accessible_organization_ids for SELECT, user_organization_ids for INSERT/UPDATE/DELETE.

### New table: `organization_ledger_settings`

```
organization_ledger_settings
├── organization_id UUID PK FK → organizations ON DELETE CASCADE
├── default_receivable_account TEXT DEFAULT '311'
├── default_payable_account TEXT DEFAULT '321'
├── default_revenue_account TEXT DEFAULT '602'
├── default_expense_account TEXT DEFAULT '501'
├── default_vat_output_account TEXT DEFAULT '343'
├── default_vat_input_account TEXT DEFAULT '343'
├── default_bank_account TEXT DEFAULT '221'
├── created_at TIMESTAMPTZ DEFAULT NOW()
├── updated_at TIMESTAMPTZ DEFAULT NOW()
```

RLS: Same pattern as organizations.

---

## 2. Automatic Invoice Posting

On invoice creation (`createInvoiceAction`), auto-generate a draft journal entry.

### Issued invoice (customer)

```
JE: "Invoice #INV-2026-0042"
  Line 1: Debit  311 (Receivable)     — gross total
  Line 2: Credit 602 (Revenue)        — net amount
  Line 3: Credit 343 (VAT Output)     — VAT amount (if applicable)
```

### Received invoice (supplier)

```
JE: "Invoice #INV-2026-0042"
  Line 1: Debit  501 (Expense)        — net amount
  Line 2: Debit  343 (VAT Input)      — VAT amount (if applicable)
  Line 3: Credit 321 (Payable)        — gross total
```

### Credit notes

Same structure with debits/credits swapped.

### Account resolution

1. Organization's `organization_ledger_settings` defaults
2. Fallback to hardcoded Slovak standard account numbers

### VAT handling

If invoice has no VAT (non-VAT payer or exempt items), skip the VAT line — 2 lines instead of 3.

### Traceability

`journal_entries.invoice_id` links back to the source invoice. Ledger UI shows clickable link.

---

## 3. SQL Balance Computation

Replace TypeScript O(n) aggregation with SQL function:

```sql
CREATE OR REPLACE FUNCTION get_account_balances(
  p_org_id UUID,
  p_year SMALLINT DEFAULT NULL,
  p_month SMALLINT DEFAULT NULL
)
RETURNS TABLE (
  account_number TEXT,
  account_name TEXT,
  account_type TEXT,
  debit_total DECIMAL,
  credit_total DECIMAL,
  balance DECIMAL
)
```

Implementation: `SUM(debit_amount)` and `SUM(credit_amount)` over `ledger_entries` joined to `journal_entries` (WHERE status = 'posted'), grouped by account. Filtered by period_year/period_month if provided.

The Balances tab continues to call `fetchBalancesAction(year, month)` — under the hood it calls the SQL RPC instead of fetching all rows.

---

## 4. Chart of Accounts Management UI

Additions to existing CoA tab:

- **Add Account** button → dialog: account_number, account_name, account_type (dropdown), parent_id (optional select), notes
- **Edit** action per row (non-system accounts only) → same dialog pre-filled
- **Deactivate/Activate** toggle per row (non-system accounts only)
- Validation: account_number unique within org, account_class auto-derived from first digit
- Guard: accounts referenced by ledger_entries cannot be deactivated

No hard delete — deactivation only.

---

## 5. Period Locking

### UI

New "Periods" tab in Ledger page:
- Table of 12 months for the selected year
- Each row: Month name, status badge (open/locked), entry count, Lock/Unlock button
- **Lock Quarter** convenience buttons (Q1-Q4) — locks 3 months at once
- **Unlock** only for the most recently locked period (prevents gaps)
- Confirmation dialog before locking

### Enforcement

- Server action guard: `createLedgerEntryAction` and `postLedgerEntryAction` check if target period is locked
- UI: "New Entry" dialog warns/prevents selection of locked period dates
- Note: RLS-level enforcement not used (too complex with generated columns); enforced at application layer

---

## 6. Out of Scope (deferred)

- Document-to-ledger posting (same pattern as invoice posting, add later)
- Server-side filtering (already implemented)
- RLS policies (already fixed in Sprint 1)
- Per-product account mapping (future enhancement)
- Multi-currency ledger entries (future sprint)
