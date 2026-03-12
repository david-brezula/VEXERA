-- Task 1: Create journal_entries table and refactor ledger_entries
-- Sprint 3: Ledger & Accounting Engine

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

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_journal_entries_org
  ON journal_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_date
  ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_journal_entries_period
  ON journal_entries(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_journal_entries_invoice
  ON journal_entries(invoice_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_status
  ON journal_entries(status);

-- 3. updated_at trigger
DROP TRIGGER IF EXISTS journal_entries_updated_at ON journal_entries;
CREATE TRIGGER journal_entries_updated_at
  BEFORE UPDATE ON journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 4. Add new columns to ledger_entries
ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS journal_entry_id UUID REFERENCES journal_entries(id) ON DELETE CASCADE;

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS account_id UUID REFERENCES chart_of_accounts(id);

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS account_number_new TEXT;

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS debit_amount DECIMAL(15,2) NOT NULL DEFAULT 0;

ALTER TABLE ledger_entries
  ADD COLUMN IF NOT EXISTS credit_amount DECIMAL(15,2) NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_ledger_journal_entry
  ON ledger_entries(journal_entry_id);

-- 5. Data migration: convert existing ledger_entries to journal_entries + debit/credit lines
DO $$
DECLARE
  le RECORD;
  je_id UUID;
  entry_num INT := 0;
BEGIN
  FOR le IN
    SELECT * FROM ledger_entries
    WHERE journal_entry_id IS NULL
    ORDER BY entry_date, created_at
  LOOP
    entry_num := entry_num + 1;

    -- Create journal entry from existing ledger entry
    INSERT INTO journal_entries (
      organization_id, entry_number, entry_date, description,
      reference_number, invoice_id, document_id, status,
      is_closing_entry, created_by, posted_by, posted_at,
      created_at, updated_at
    ) VALUES (
      le.organization_id,
      'JE-MIG-' || LPAD(entry_num::TEXT, 6, '0'),
      le.entry_date,
      le.description,
      le.reference_number,
      le.invoice_id,
      le.document_id,
      le.status,
      le.is_closing_entry,
      le.created_by,
      le.posted_by,
      le.posted_at,
      le.created_at,
      le.updated_at
    )
    RETURNING id INTO je_id;

    -- Update original row as the debit line
    UPDATE ledger_entries
    SET journal_entry_id   = je_id,
        account_id         = le.debit_account_id,
        account_number_new = le.debit_account_number,
        debit_amount       = le.amount,
        credit_amount      = 0
    WHERE id = le.id;

    -- Insert new row as the credit line
    INSERT INTO ledger_entries (
      organization_id, invoice_id, document_id, entry_date,
      description, reference_number,
      debit_account_id, credit_account_id,
      debit_account_number, credit_account_number,
      amount, currency, status, is_closing_entry,
      created_by, posted_by, posted_at,
      created_at, updated_at,
      journal_entry_id, account_id, account_number_new,
      debit_amount, credit_amount
    ) VALUES (
      le.organization_id, le.invoice_id, le.document_id, le.entry_date,
      le.description, le.reference_number,
      le.debit_account_id, le.credit_account_id,
      le.debit_account_number, le.credit_account_number,
      le.amount, le.currency, le.status, le.is_closing_entry,
      le.created_by, le.posted_by, le.posted_at,
      le.created_at, le.updated_at,
      je_id, le.credit_account_id, le.credit_account_number,
      0, le.amount
    );
  END LOOP;
END $$;

-- 6. Fix reversed_by references: map old ledger_entries.reversed_by to journal_entries
-- For each journal entry whose source ledger_entry had a reversed_by,
-- point it to the journal entry that was created from the reversing ledger_entry.
UPDATE journal_entries je
SET reversed_by = (
  SELECT le2.journal_entry_id
  FROM ledger_entries le_orig
  JOIN ledger_entries le2 ON le2.id = le_orig.reversed_by
  WHERE le_orig.journal_entry_id = je.id
    AND le_orig.reversed_by IS NOT NULL
  LIMIT 1
)
WHERE EXISTS (
  SELECT 1 FROM ledger_entries le_orig
  WHERE le_orig.journal_entry_id = je.id
    AND le_orig.reversed_by IS NOT NULL
);

-- 7. RLS policies for journal_entries
ALTER TABLE journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "journal_entries_select"
  ON journal_entries FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

CREATE POLICY "journal_entries_insert"
  ON journal_entries FOR INSERT
  WITH CHECK (organization_id = ANY(get_accessible_organization_ids()));

CREATE POLICY "journal_entries_update"
  ON journal_entries FOR UPDATE
  USING (
    organization_id = ANY(get_accessible_organization_ids())
    AND status = 'draft'
  );

CREATE POLICY "journal_entries_delete"
  ON journal_entries FOR DELETE
  USING (
    organization_id = ANY(get_user_organization_ids())
    AND status = 'draft'
  );
