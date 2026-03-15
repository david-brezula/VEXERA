# Sprint 3: Ledger & Accounting Engine Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make the ledger production-ready with compound journal entries, automatic invoice posting, SQL-based balances, CoA management, and fiscal period locking.

**Architecture:** New `journal_entries` parent table groups multi-line `ledger_entries`. Invoices auto-create draft journal entries on creation. Org-level default account mappings with Slovak standard fallbacks. Monthly fiscal periods with quarterly lock convenience.

**Tech Stack:** Supabase (PostgreSQL, RLS), Next.js 15 App Router, TypeScript, TanStack Query, shadcn/ui, server actions.

**Design doc:** `docs/plans/2026-03-12-sprint-3-ledger-accounting-engine-design.md`

---

## Phase A: Schema & Migration

### Task 1: Create journal_entries table and refactor ledger_entries

**Files:**
- Create: `supabase/migrations/20240101000045_journal_entries.sql`
- Modify: `packages/types/src/index.ts`

**Context:** Currently `ledger_entries` has single debit/credit columns per row. We need a parent `journal_entries` table, and `ledger_entries` becomes line items with `debit_amount`/`credit_amount` per line.

**Step 1: Write migration**

Create `supabase/migrations/20240101000045_journal_entries.sql`:

```sql
-- 1. Create journal_entries parent table
CREATE TABLE IF NOT EXISTS journal_entries (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  entry_number      TEXT NOT NULL,
  entry_date        DATE NOT NULL,
  period_year       SMALLINT NOT NULL GENERATED ALWAYS AS (EXTRACT(YEAR FROM entry_date)::SMALLINT) STORED,
  period_month      SMALLINT NOT NULL GENERATED ALWAYS AS (EXTRACT(MONTH FROM entry_date)::SMALLINT) STORED,
  description       TEXT NOT NULL,
  reference_number  TEXT,
  invoice_id        UUID REFERENCES invoices(id) ON DELETE SET NULL,
  document_id       UUID REFERENCES documents(id) ON DELETE SET NULL,
  status            TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','posted','reversed')),
  is_closing_entry  BOOLEAN NOT NULL DEFAULT FALSE,
  reversed_by       UUID REFERENCES journal_entries(id),
  created_by        UUID REFERENCES profiles(id),
  posted_by         UUID REFERENCES profiles(id),
  posted_at         TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_je_org ON journal_entries(organization_id);
CREATE INDEX idx_je_date ON journal_entries(entry_date);
CREATE INDEX idx_je_period ON journal_entries(period_year, period_month);
CREATE INDEX idx_je_invoice ON journal_entries(invoice_id);
CREATE INDEX idx_je_status ON journal_entries(status);

CREATE TRIGGER journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 2. Add new columns to ledger_entries
ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES chart_of_accounts(id),
  ADD COLUMN IF NOT EXISTS account_number_new TEXT,
  ADD COLUMN IF NOT EXISTS debit_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_amount DECIMAL(15,2) NOT NULL DEFAULT 0;

CREATE INDEX idx_le_journal ON ledger_entries(journal_entry_id);

-- 3. Migrate existing ledger_entries → journal_entries + line items
-- For each existing entry, create a journal_entry and two line items
DO $$
DECLARE
  r RECORD;
  je_id UUID;
BEGIN
  FOR r IN SELECT * FROM ledger_entries WHERE journal_entry_id IS NULL
  LOOP
    -- Create parent journal entry
    INSERT INTO journal_entries (
      id, organization_id, entry_number, entry_date, description, reference_number,
      invoice_id, document_id, status, is_closing_entry, reversed_by,
      created_by, posted_by, posted_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(), r.organization_id,
      'JE-MIGRATED-' || LEFT(r.id::text, 8),
      r.entry_date, r.description, r.reference_number,
      r.invoice_id, r.document_id, r.status, r.is_closing_entry, NULL,
      r.created_by, r.posted_by, r.posted_at, r.created_at, r.updated_at
    ) RETURNING id INTO je_id;

    -- Update original row as debit line
    UPDATE ledger_entries SET
      journal_entry_id = je_id,
      account_id = r.debit_account_id,
      account_number_new = r.debit_account_number,
      debit_amount = r.amount,
      credit_amount = 0
    WHERE id = r.id;

    -- Insert credit line
    INSERT INTO ledger_entries (
      organization_id, journal_entry_id, account_id, account_number_new,
      debit_amount, credit_amount,
      -- Keep old columns populated for backward compat during migration
      entry_date, description, reference_number,
      debit_account_number, credit_account_number, amount, currency,
      status, is_closing_entry, created_by, created_at
    ) VALUES (
      r.organization_id, je_id, r.credit_account_id, r.credit_account_number,
      0, r.amount,
      r.entry_date, r.description, r.reference_number,
      r.debit_account_number, r.credit_account_number, r.amount, r.currency,
      r.status, r.is_closing_entry, r.created_by, r.created_at
    );
  END LOOP;
END $$;

-- 4. Fix reversed_by references in journal_entries
-- Map old ledger_entries.reversed_by to the new journal_entries
DO $$
DECLARE
  r RECORD;
  target_je_id UUID;
BEGIN
  FOR r IN
    SELECT je.id AS je_id, le.reversed_by AS old_reversed_by
    FROM journal_entries je
    JOIN ledger_entries le ON le.journal_entry_id = je.id
    WHERE le.reversed_by IS NOT NULL
    LIMIT 1000
  LOOP
    SELECT journal_entry_id INTO target_je_id
    FROM ledger_entries WHERE id = r.old_reversed_by;

    IF target_je_id IS NOT NULL THEN
      UPDATE journal_entries SET reversed_by = target_je_id WHERE id = r.je_id;
    END IF;
  END LOOP;
END $$;

-- 5. RLS policies for journal_entries
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "je_select"
  ON journal_entries FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

CREATE POLICY "je_insert"
  ON journal_entries FOR INSERT
  WITH CHECK (organization_id = ANY(get_accessible_organization_ids()));

CREATE POLICY "je_update_draft"
  ON journal_entries FOR UPDATE
  USING (organization_id = ANY(get_accessible_organization_ids()) AND status = 'draft');

CREATE POLICY "je_delete_draft"
  ON journal_entries FOR DELETE
  USING (organization_id = ANY(get_user_organization_ids()) AND status = 'draft');
```

**Step 2: Add JournalEntry types to packages/types**

In `packages/types/src/index.ts`, add:

```typescript
export type JournalEntryStatus = 'draft' | 'posted' | 'reversed'
```

**Step 3: Commit**

```bash
git add supabase/migrations/20240101000045_journal_entries.sql packages/types/src/index.ts
git commit -m "feat(db): add journal_entries table and migrate existing ledger entries"
```

---

### Task 2: Create fiscal_periods and organization_ledger_settings tables

**Files:**
- Create: `supabase/migrations/20240101000046_fiscal_periods_and_ledger_settings.sql`

**Step 1: Write migration**

Create `supabase/migrations/20240101000046_fiscal_periods_and_ledger_settings.sql`:

```sql
-- 1. Fiscal periods table
CREATE TABLE IF NOT EXISTS fiscal_periods (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  year              SMALLINT NOT NULL,
  month             SMALLINT NOT NULL CHECK (month BETWEEN 1 AND 12),
  status            TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','locked','archived')),
  locked_at         TIMESTAMPTZ,
  locked_by         UUID REFERENCES profiles(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, year, month)
);

CREATE INDEX idx_fp_org ON fiscal_periods(organization_id);
CREATE INDEX idx_fp_org_year ON fiscal_periods(organization_id, year);

ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fp_select"
  ON fiscal_periods FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

CREATE POLICY "fp_insert"
  ON fiscal_periods FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

CREATE POLICY "fp_update"
  ON fiscal_periods FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));

CREATE POLICY "fp_delete"
  ON fiscal_periods FOR DELETE
  USING (organization_id = ANY(get_user_organization_ids()));

-- 2. Organization ledger settings (default account mapping)
CREATE TABLE IF NOT EXISTS organization_ledger_settings (
  organization_id             UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  default_receivable_account  TEXT NOT NULL DEFAULT '311',
  default_payable_account     TEXT NOT NULL DEFAULT '321',
  default_revenue_account     TEXT NOT NULL DEFAULT '602',
  default_expense_account     TEXT NOT NULL DEFAULT '501',
  default_vat_output_account  TEXT NOT NULL DEFAULT '343',
  default_vat_input_account   TEXT NOT NULL DEFAULT '343',
  default_bank_account        TEXT NOT NULL DEFAULT '221',
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER org_ledger_settings_updated_at
  BEFORE UPDATE ON organization_ledger_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE organization_ledger_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ols_select"
  ON organization_ledger_settings FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

CREATE POLICY "ols_insert"
  ON organization_ledger_settings FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

CREATE POLICY "ols_update"
  ON organization_ledger_settings FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));
```

**Step 2: Commit**

```bash
git add supabase/migrations/20240101000046_fiscal_periods_and_ledger_settings.sql
git commit -m "feat(db): add fiscal_periods and organization_ledger_settings tables"
```

---

### Task 3: Create SQL function for account balances

**Files:**
- Create: `supabase/migrations/20240101000047_get_account_balances_fn.sql`

**Step 1: Write migration**

Create `supabase/migrations/20240101000047_get_account_balances_fn.sql`:

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
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    le.account_number_new AS account_number,
    COALESCE(ca.account_name, le.account_number_new) AS account_name,
    COALESCE(ca.account_type, 'asset') AS account_type,
    COALESCE(SUM(le.debit_amount), 0) AS debit_total,
    COALESCE(SUM(le.credit_amount), 0) AS credit_total,
    COALESCE(SUM(le.debit_amount), 0) - COALESCE(SUM(le.credit_amount), 0) AS balance
  FROM ledger_entries le
  JOIN journal_entries je ON je.id = le.journal_entry_id
  LEFT JOIN chart_of_accounts ca
    ON ca.account_number = le.account_number_new
    AND (ca.organization_id = p_org_id OR ca.organization_id IS NULL)
  WHERE je.organization_id = p_org_id
    AND je.status = 'posted'
    AND (p_year IS NULL OR je.period_year = p_year)
    AND (p_month IS NULL OR je.period_month = p_month)
  GROUP BY le.account_number_new, ca.account_name, ca.account_type
  ORDER BY le.account_number_new;
$$;
```

**Step 2: Commit**

```bash
git add supabase/migrations/20240101000047_get_account_balances_fn.sql
git commit -m "feat(db): add get_account_balances SQL function"
```

---

## Phase B: Data Layer & Server Actions

### Task 4: Rewrite data/ledger.ts for journal entries model

**Files:**
- Modify: `apps/web/src/lib/data/ledger.ts`

**Context:** Replace the current types and queries to work with journal_entries as the primary entity and ledger_entries as line items. The UI will display journal entries in the Journal tab, with line items visible as expandable rows.

**Step 1: Update types and queries**

Replace types in `apps/web/src/lib/data/ledger.ts`:

```typescript
// --- NEW TYPES ---

export type JournalEntryLine = {
  id: string
  account_number: string
  account_name?: string
  debit_amount: number
  credit_amount: number
}

export type JournalEntry = {
  id: string
  entry_number: string
  entry_date: string
  description: string
  reference_number: string | null
  invoice_id: string | null
  document_id: string | null
  status: "draft" | "posted" | "reversed"
  is_closing_entry: boolean
  created_by: string | null
  posted_by: string | null
  posted_at: string | null
  created_at: string
  total_amount: number
  lines: JournalEntryLine[]
}

// Keep ChartAccount and LedgerSummary as-is
// Replace AccountBalance to match SQL function return
```

Replace `getLedgerEntries()` to query `journal_entries` with nested `ledger_entries` lines. Use two queries:
1. Fetch journal_entries (paginated, filtered by status/date/search)
2. For each journal_entry, fetch its ledger_entries lines

Replace `getAccountBalances()` to call the SQL RPC `get_account_balances(org_id, year, month)` instead of TypeScript aggregation.

Replace `getLedgerSummary()` to query `journal_entries` instead of `ledger_entries`.

**Step 2: Commit**

```bash
git add apps/web/src/lib/data/ledger.ts
git commit -m "feat(ledger): rewrite data layer for journal entries model"
```

---

### Task 5: Rewrite actions/ledger.ts for journal entries model

**Files:**
- Modify: `apps/web/src/lib/actions/ledger.ts`

**Context:** All ledger actions now operate on `journal_entries` + child `ledger_entries`. The create action must insert parent + lines. Post/reverse/delete operate on journal_entries.

**Step 1: Rewrite all server actions**

Key changes:
- `createLedgerEntryAction` → `createJournalEntryAction`: accepts `{ entry_date, description, reference_number?, lines: { account_number, debit_amount, credit_amount }[] }`. Validates sum(debits) = sum(credits). Inserts journal_entry + N ledger_entries lines.
- `postLedgerEntryAction` → `postJournalEntryAction`: posts a journal_entry (sets status=posted, posted_by, posted_at).
- `reverseLedgerEntryAction` → `reverseJournalEntryAction`: creates a new journal_entry with swapped debit/credit lines, marks original as reversed.
- `deleteLedgerEntryAction` → `deleteJournalEntryAction`: deletes draft journal_entry (cascade deletes lines).
- `batchPostEntriesAction` → `batchPostJournalEntriesAction`: batch-posts multiple journal_entries.
- `fetchBalancesAction`: now calls Supabase RPC `get_account_balances`.
- Auto-generate `entry_number` in format `JE-{YYYY}-{NNNN}` (sequential per org per year).

Also add **period lock check**: before creating or posting, query `fiscal_periods` for the entry_date's year/month. If status = 'locked', return error.

**Step 2: Commit**

```bash
git add apps/web/src/lib/actions/ledger.ts
git commit -m "feat(ledger): rewrite server actions for journal entries model"
```

---

### Task 6: Add fiscal period and ledger settings actions

**Files:**
- Create: `apps/web/src/lib/actions/fiscal-periods.ts`
- Create: `apps/web/src/lib/actions/ledger-settings.ts`
- Create: `apps/web/src/lib/data/fiscal-periods.ts`
- Create: `apps/web/src/lib/data/ledger-settings.ts`

**Step 1: Create fiscal periods actions**

`apps/web/src/lib/actions/fiscal-periods.ts`:
- `lockPeriodAction(year, month)`: creates/updates fiscal_period to status='locked', sets locked_at and locked_by. Validates no entries in 'draft' status exist for that period (must post or delete first).
- `unlockPeriodAction(year, month)`: sets status='open', clears locked_at/locked_by. Only allows unlocking the most recently locked period.
- `lockQuarterAction(year, quarter)`: locks months (quarter*3-2) through (quarter*3). Calls lockPeriodAction for each month.

`apps/web/src/lib/data/fiscal-periods.ts`:
- `getFiscalPeriods(year)`: fetches all fiscal_periods for org for a given year.

**Step 2: Create ledger settings actions**

`apps/web/src/lib/actions/ledger-settings.ts`:
- `getLedgerSettingsAction()`: fetches org's ledger settings, returns defaults if none exist.
- `updateLedgerSettingsAction(settings)`: upserts organization_ledger_settings.

`apps/web/src/lib/data/ledger-settings.ts`:
- `getLedgerSettings()`: fetches or returns default settings object.

**Step 3: Commit**

```bash
git add apps/web/src/lib/actions/fiscal-periods.ts apps/web/src/lib/actions/ledger-settings.ts apps/web/src/lib/data/fiscal-periods.ts apps/web/src/lib/data/ledger-settings.ts
git commit -m "feat(ledger): add fiscal period and ledger settings actions"
```

---

### Task 7: Add automatic invoice-to-ledger posting

**Files:**
- Create: `apps/web/src/lib/actions/invoice-posting.ts`
- Modify: `apps/web/src/lib/actions/invoices.ts`

**Context:** When an invoice is created via `createInvoiceAction`, auto-generate a draft journal entry. Account mapping uses org ledger settings with Slovak standard fallbacks.

**Step 1: Create invoice posting helper**

`apps/web/src/lib/actions/invoice-posting.ts`:

```typescript
"use server"

// postInvoiceToLedger(supabase, orgId, userId, invoice, items)
// 1. Fetch org ledger settings (or use defaults)
// 2. Build journal entry lines based on invoice_type:
//    - 'issued': Debit receivable (311), Credit revenue (602) + Credit VAT output (343)
//    - 'received': Debit expense (501) + Debit VAT input (343), Credit payable (321)
//    - 'credit_note': Reversed version of above
// 3. If VAT amount = 0, skip VAT line
// 4. Insert journal_entry with invoice_id reference
// 5. Insert ledger_entries lines
// 6. Return journal_entry id
```

**Step 2: Integrate into createInvoiceAction**

In `apps/web/src/lib/actions/invoices.ts`, after invoice items are inserted (around line 197), add:

```typescript
// Auto-create draft journal entry for ledger
await postInvoiceToLedger(supabase, orgId, user.id, {
  id: invoice.id,
  invoice_number: invoiceData.invoice_number,
  invoice_type: values.invoice_type,
  issue_date: values.issue_date,
  subtotal: calculatedSubtotal,
  vat_amount: calculatedVat,
  total: calculatedTotal,
}, values.items)
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/actions/invoice-posting.ts apps/web/src/lib/actions/invoices.ts
git commit -m "feat(ledger): auto-create draft journal entry on invoice creation"
```

---

## Phase C: UI — Ledger Client Rewrite

### Task 8: Rewrite Journal tab for journal entries

**Files:**
- Modify: `apps/web/src/components/ledger/ledger-client.tsx`
- Modify: `apps/web/src/app/(dashboard)/ledger/page.tsx`

**Context:** The Journal tab currently shows flat ledger_entries. Rewrite to show journal_entries with expandable line items. The "New Entry" dialog must support multiple debit/credit lines.

**Step 1: Update props and page data fetching**

Update `LedgerClientProps` to use `JournalEntry[]` instead of `LedgerEntry[]`. Update `ledger/page.tsx` to call the new `getJournalEntries()` function.

**Step 2: Rewrite Journal table**

Replace single-row entries with journal entries that show:
- Row: Date, Entry Number, Reference, Description, Total Amount, Status, Actions
- Expandable: click row to see line items (account_number, debit_amount, credit_amount per line)
- Selection checkboxes for batch posting (draft only)
- Actions: Post (draft), Reverse (posted), Delete (draft)

**Step 3: Rewrite "New Entry" dialog**

Replace single debit/credit fields with a dynamic line items editor:
- Entry fields: date, description, reference_number
- Lines table: account_number (Select from accounts), debit_amount, credit_amount
- "Add line" button
- Validation: sum(debits) must equal sum(credits), at least 2 lines
- Running totals shown below the lines

**Step 4: Update summary stats**

Summary cards now count journal_entries instead of ledger_entries.

**Step 5: Add invoice link**

For journal entries with `invoice_id`, show a clickable link icon that navigates to `/invoices/{invoice_id}`.

**Step 6: Commit**

```bash
git add apps/web/src/components/ledger/ledger-client.tsx apps/web/src/app/(dashboard)/ledger/page.tsx
git commit -m "feat(ledger): rewrite Journal tab for compound journal entries"
```

---

### Task 9: Add Chart of Accounts management UI

**Files:**
- Modify: `apps/web/src/components/ledger/ledger-client.tsx`
- Create: `apps/web/src/lib/actions/chart-of-accounts.ts`

**Context:** Currently CoA tab is read-only. Add create, edit, and deactivate functionality for non-system accounts.

**Step 1: Create CoA server actions**

`apps/web/src/lib/actions/chart-of-accounts.ts`:
- `createAccountAction({ account_number, account_name, account_type, parent_id?, notes? })`: inserts into chart_of_accounts. Derives account_class from first digit of account_number.
- `updateAccountAction(accountId, { account_name, account_type, notes? })`: updates non-system account. Cannot change account_number (referential integrity).
- `toggleAccountActiveAction(accountId)`: toggles is_active. Before deactivating, checks no ledger_entries reference this account.

**Step 2: Add UI to CoA tab**

- "Add Account" button → Dialog with: account_number (text, pattern=[0-9]+), account_name, account_type (Select dropdown), notes (optional textarea)
- Per-row "Edit" button (non-system only) → same dialog pre-filled
- Per-row "Deactivate"/"Activate" toggle (non-system only) → confirmation for deactivate

**Step 3: Commit**

```bash
git add apps/web/src/lib/actions/chart-of-accounts.ts apps/web/src/components/ledger/ledger-client.tsx
git commit -m "feat(ledger): add chart of accounts management UI"
```

---

### Task 10: Add Periods tab with locking UI

**Files:**
- Modify: `apps/web/src/components/ledger/ledger-client.tsx`
- Modify: `apps/web/src/app/(dashboard)/ledger/page.tsx`

**Context:** Add a 4th tab "Periods" to the ledger page for managing fiscal period locks.

**Step 1: Update page data fetching**

In `ledger/page.tsx`, add `getFiscalPeriods(currentYear)` to the parallel data fetch. Pass as prop to LedgerClient.

**Step 2: Build Periods tab UI**

Add `TabsTrigger value="periods"` and `TabsContent value="periods"`:
- Year selector (same as Balances tab)
- Table with 12 rows (Jan–Dec), columns: Month, Status badge (open=green, locked=yellow, archived=gray), Entries Count, Actions
- "Lock" button per open month → confirmation dialog: "Lock {Month} {Year}? Draft entries must be posted or deleted first."
- "Unlock" button per locked month (only most recently locked)
- "Lock Quarter" buttons (Q1–Q4) above the table → locks 3 months at once

**Step 3: Wire up actions**

- Lock calls `lockPeriodAction(year, month)`, refreshes via `revalidatePath`
- Unlock calls `unlockPeriodAction(year, month)`
- Lock Quarter calls `lockQuarterAction(year, quarter)`
- Error handling: show toast if draft entries exist in the period

**Step 4: Commit**

```bash
git add apps/web/src/components/ledger/ledger-client.tsx apps/web/src/app/(dashboard)/ledger/page.tsx
git commit -m "feat(ledger): add Periods tab with monthly/quarterly locking"
```

---

## Phase D: Verification & Cleanup

### Task 11: Type-check and build verification

**Files:** None (verification only)

**Step 1: Run type-check**

```bash
cd apps/web && npx pnpm tsc --noEmit
```

Expected: 0 errors. Fix any type errors.

**Step 2: Run build**

```bash
cd apps/web && npx pnpm build
```

Expected: successful build. Fix any build errors.

**Step 3: Commit any fixes**

```bash
git add -A && git commit -m "fix: resolve type and build errors from Sprint 3"
```

---

## Task Dependency Graph

```
Phase A (Schema):
  Task 1 (journal_entries) → Task 2 (fiscal_periods) → Task 3 (SQL balances fn)

Phase B (Data Layer): depends on Phase A
  Task 4 (data/ledger.ts) → Task 5 (actions/ledger.ts)
  Task 6 (fiscal + settings actions) — independent of 4/5
  Task 7 (invoice posting) — depends on Task 5

Phase C (UI): depends on Phase B
  Task 8 (Journal tab rewrite) — depends on Tasks 4, 5
  Task 9 (CoA management) — independent of Task 8
  Task 10 (Periods tab) — depends on Task 6

Phase D (Verification): depends on all above
  Task 11 (type-check + build)
```

## Batch Execution Strategy

| Batch | Tasks | Dependencies |
|-------|-------|-------------|
| 1 | Tasks 1, 2, 3 | None (sequential migrations) |
| 2 | Tasks 4, 5, 6 | Batch 1 complete |
| 3 | Tasks 7, 8, 9, 10 | Batch 2 complete |
| 4 | Task 11 | Batch 3 complete |
