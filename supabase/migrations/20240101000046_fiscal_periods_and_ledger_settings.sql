-- Task 2: Create fiscal_periods and organization_ledger_settings tables
-- Sprint 3: Ledger & Accounting Engine

-- ─── fiscal_periods ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS fiscal_periods (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  year             SMALLINT NOT NULL,
  month            SMALLINT NOT NULL CHECK (month >= 1 AND month <= 12),
  status           TEXT NOT NULL DEFAULT 'open'
                     CHECK (status IN ('open','locked','archived')),
  locked_at        TIMESTAMPTZ,
  locked_by        UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, year, month)
);

CREATE INDEX IF NOT EXISTS idx_fiscal_periods_org
  ON fiscal_periods(organization_id);

ALTER TABLE fiscal_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fiscal_periods_select"
  ON fiscal_periods FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

CREATE POLICY "fiscal_periods_insert"
  ON fiscal_periods FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

CREATE POLICY "fiscal_periods_update"
  ON fiscal_periods FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));

CREATE POLICY "fiscal_periods_delete"
  ON fiscal_periods FOR DELETE
  USING (organization_id = ANY(get_user_organization_ids()));

-- ─── organization_ledger_settings ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS organization_ledger_settings (
  organization_id            UUID PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  default_receivable_account TEXT NOT NULL DEFAULT '311',
  default_payable_account    TEXT NOT NULL DEFAULT '321',
  default_revenue_account    TEXT NOT NULL DEFAULT '602',
  default_expense_account    TEXT NOT NULL DEFAULT '501',
  default_vat_output_account TEXT NOT NULL DEFAULT '343',
  default_vat_input_account  TEXT NOT NULL DEFAULT '343',
  default_bank_account       TEXT NOT NULL DEFAULT '221',
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS organization_ledger_settings_updated_at ON organization_ledger_settings;
CREATE TRIGGER organization_ledger_settings_updated_at
  BEFORE UPDATE ON organization_ledger_settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE organization_ledger_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "org_ledger_settings_select"
  ON organization_ledger_settings FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

CREATE POLICY "org_ledger_settings_insert"
  ON organization_ledger_settings FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

CREATE POLICY "org_ledger_settings_update"
  ON organization_ledger_settings FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));
