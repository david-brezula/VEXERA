CREATE TABLE IF NOT EXISTS ledger_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id            UUID REFERENCES invoices(id) ON DELETE SET NULL,
  document_id           UUID REFERENCES documents(id) ON DELETE SET NULL,
  entry_date            DATE NOT NULL,
  period_year           SMALLINT NOT NULL GENERATED ALWAYS AS (EXTRACT(YEAR FROM entry_date)::SMALLINT) STORED,
  period_month          SMALLINT NOT NULL GENERATED ALWAYS AS (EXTRACT(MONTH FROM entry_date)::SMALLINT) STORED,
  description           TEXT NOT NULL,
  reference_number      TEXT,
  debit_account_id      UUID REFERENCES chart_of_accounts(id),
  credit_account_id     UUID REFERENCES chart_of_accounts(id),
  debit_account_number  TEXT NOT NULL,
  credit_account_number TEXT NOT NULL,
  amount                DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  currency              TEXT NOT NULL DEFAULT 'EUR',
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','posted','reversed')),
  is_closing_entry      BOOLEAN NOT NULL DEFAULT FALSE,
  reversed_by           UUID REFERENCES ledger_entries(id),
  created_by            UUID REFERENCES profiles(id),
  posted_by             UUID REFERENCES profiles(id),
  posted_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ledger_org        ON ledger_entries(organization_id);
CREATE INDEX IF NOT EXISTS idx_ledger_date       ON ledger_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_ledger_period     ON ledger_entries(period_year, period_month);
CREATE INDEX IF NOT EXISTS idx_ledger_debit_acc  ON ledger_entries(debit_account_number);
CREATE INDEX IF NOT EXISTS idx_ledger_credit_acc ON ledger_entries(credit_account_number);

DROP TRIGGER IF EXISTS ledger_entries_updated_at ON ledger_entries;
CREATE TRIGGER ledger_entries_updated_at
  BEFORE UPDATE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
