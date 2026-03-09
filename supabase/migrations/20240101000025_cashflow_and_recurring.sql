-- Recurring transaction patterns: detected from bank transaction history.
-- Used for cash flow forecasting and anomaly detection.

CREATE TABLE IF NOT EXISTS recurring_patterns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  counterpart_name TEXT,                      -- vendor/customer name
  counterpart_iban TEXT,                      -- IBAN for matching
  typical_amount   NUMERIC(15,2) NOT NULL,    -- average amount
  amount_stddev    NUMERIC(15,2) DEFAULT 0,   -- standard deviation
  currency         TEXT NOT NULL DEFAULT 'EUR',
  direction        TEXT NOT NULL CHECK (direction IN ('inflow', 'outflow')),
  frequency_days   INTEGER NOT NULL,          -- avg days between occurrences
  last_seen_at     DATE,                      -- last transaction date
  next_expected_at DATE,                      -- predicted next occurrence
  occurrence_count INTEGER NOT NULL DEFAULT 0,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  category         TEXT,                      -- auto-detected or assigned category
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_recurring_patterns_org ON recurring_patterns(organization_id);

ALTER TABLE recurring_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage recurring patterns"
  ON recurring_patterns
  FOR ALL
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
    )
  );
