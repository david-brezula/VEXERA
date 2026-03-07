-- VAT return pre-calculations.
-- Stores quarterly VAT position computed from categorized invoices/documents.

CREATE TABLE IF NOT EXISTS vat_returns (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_year      INTEGER NOT NULL,
  period_quarter   INTEGER NOT NULL CHECK (period_quarter BETWEEN 1 AND 4),
  -- VAT collected (output VAT — from issued invoices)
  vat_output_20    NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_output_10    NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_output_5     NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- VAT paid (input VAT — from received invoices/documents)
  vat_input_20     NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_input_10     NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_input_5      NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- Totals
  total_output_vat NUMERIC(15,2) NOT NULL DEFAULT 0,
  total_input_vat  NUMERIC(15,2) NOT NULL DEFAULT 0,
  vat_liability    NUMERIC(15,2) NOT NULL DEFAULT 0,  -- output - input (positive = owe, negative = refund)
  -- Base amounts
  taxable_base_output NUMERIC(15,2) NOT NULL DEFAULT 0,
  taxable_base_input  NUMERIC(15,2) NOT NULL DEFAULT 0,
  -- Status
  status           TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final', 'submitted')),
  document_count   INTEGER NOT NULL DEFAULT 0,
  computed_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finalized_at     TIMESTAMPTZ,
  finalized_by     UUID REFERENCES profiles(id),
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(organization_id, period_year, period_quarter)
);

CREATE INDEX idx_vat_returns_org ON vat_returns(organization_id, period_year, period_quarter);

ALTER TABLE vat_returns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage vat returns"
  ON vat_returns
  FOR ALL
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
    )
  );
