-- =============================================================
-- Bank Accounts
-- =============================================================
-- Stores bank accounts belonging to an organization.
-- One org can have multiple bank accounts (CZK, EUR, etc.)

CREATE TABLE IF NOT EXISTS bank_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  bank_name        TEXT NOT NULL,
  iban             TEXT NOT NULL,
  swift            TEXT,
  currency         TEXT NOT NULL DEFAULT 'EUR',
  account_holder   TEXT,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT bank_accounts_iban_org_unique UNIQUE (organization_id, iban)
);

CREATE INDEX IF NOT EXISTS idx_bank_accounts_org ON bank_accounts(organization_id);

DROP TRIGGER IF EXISTS bank_accounts_updated_at ON bank_accounts;
CREATE TRIGGER bank_accounts_updated_at
  BEFORE UPDATE ON bank_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- RLS
-- =============================================================
ALTER TABLE bank_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bank_accounts_select" ON bank_accounts;
CREATE POLICY "bank_accounts_select" ON bank_accounts FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

DROP POLICY IF EXISTS "bank_accounts_insert" ON bank_accounts;
CREATE POLICY "bank_accounts_insert" ON bank_accounts FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "bank_accounts_update" ON bank_accounts;
CREATE POLICY "bank_accounts_update" ON bank_accounts FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "bank_accounts_delete" ON bank_accounts;
CREATE POLICY "bank_accounts_delete" ON bank_accounts FOR DELETE
  USING (organization_id = ANY(get_user_organization_ids()));
