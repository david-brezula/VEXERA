CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  account_number   TEXT NOT NULL,
  account_name     TEXT NOT NULL,
  account_class    TEXT NOT NULL,
  account_type     TEXT NOT NULL
                     CHECK (account_type IN ('asset','liability','equity','revenue','expense','off_balance')),
  parent_id        UUID REFERENCES chart_of_accounts(id),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  is_system        BOOLEAN NOT NULL DEFAULT FALSE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_coa_org_number ON chart_of_accounts(organization_id, account_number)
  WHERE organization_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_coa_number ON chart_of_accounts(account_number);
