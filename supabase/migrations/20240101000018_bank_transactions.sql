-- =============================================================
-- Bank Transactions
-- =============================================================
-- Individual debit/credit lines imported from bank statements.
-- Linked to bank_accounts and optionally matched to invoices.

CREATE TABLE IF NOT EXISTS bank_transactions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_account_id       UUID NOT NULL REFERENCES bank_accounts(id) ON DELETE CASCADE,

  -- Transaction data (as it appears on the bank statement)
  transaction_date      DATE NOT NULL,
  amount                NUMERIC(15, 2) NOT NULL,         -- positive = credit, negative = debit
  currency              TEXT NOT NULL DEFAULT 'EUR',
  variable_symbol       TEXT,
  constant_symbol       TEXT,
  specific_symbol       TEXT,
  description           TEXT,
  counterpart_iban      TEXT,
  counterpart_name      TEXT,

  -- Reconciliation
  match_status          TEXT NOT NULL DEFAULT 'unmatched'
                          CHECK (match_status IN ('unmatched', 'matched', 'manually_matched', 'ignored')),
  matched_invoice_id    UUID REFERENCES invoices(id) ON DELETE SET NULL,
  matched_at            TIMESTAMPTZ,
  matched_by            UUID REFERENCES profiles(id),

  -- Import provenance (for deduplication)
  source_file_name      TEXT,
  source_file_checksum  TEXT,
  external_id           TEXT,                            -- bank-assigned unique ID when available

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate import of same transaction from same file
  CONSTRAINT bank_transactions_external_unique UNIQUE (bank_account_id, external_id)
    DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX IF NOT EXISTS idx_bank_txn_org          ON bank_transactions(organization_id);
CREATE INDEX IF NOT EXISTS idx_bank_txn_account       ON bank_transactions(bank_account_id);
CREATE INDEX IF NOT EXISTS idx_bank_txn_date          ON bank_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_bank_txn_match_status  ON bank_transactions(match_status);
CREATE INDEX IF NOT EXISTS idx_bank_txn_vs            ON bank_transactions(variable_symbol) WHERE variable_symbol IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_bank_txn_invoice       ON bank_transactions(matched_invoice_id) WHERE matched_invoice_id IS NOT NULL;

DROP TRIGGER IF EXISTS bank_transactions_updated_at ON bank_transactions;
CREATE TRIGGER bank_transactions_updated_at
  BEFORE UPDATE ON bank_transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- RLS
-- =============================================================
ALTER TABLE bank_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_transactions_select" ON bank_transactions;
CREATE POLICY "bank_transactions_select" ON bank_transactions FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

DROP POLICY IF EXISTS "bank_transactions_insert" ON bank_transactions;
CREATE POLICY "bank_transactions_insert" ON bank_transactions FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "bank_transactions_update" ON bank_transactions;
CREATE POLICY "bank_transactions_update" ON bank_transactions FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "bank_transactions_delete" ON bank_transactions;
CREATE POLICY "bank_transactions_delete" ON bank_transactions FOR DELETE
  USING (organization_id = ANY(get_user_organization_ids()));
