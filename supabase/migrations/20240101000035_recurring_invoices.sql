-- =============================================================
-- Recurring Invoice Templates
-- =============================================================
-- Templates for auto-generating invoices on a schedule.
-- The queue processor creates invoices when next_run_at <= now().

CREATE TABLE IF NOT EXISTS recurring_invoice_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  template_name    TEXT NOT NULL,
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,

  -- Invoice template fields (mirror invoice schema)
  invoice_type     TEXT NOT NULL DEFAULT 'issued',
  customer_name    TEXT NOT NULL,
  customer_ico     TEXT,
  customer_dic     TEXT,
  customer_ic_dph  TEXT,
  customer_address TEXT,
  customer_email   TEXT,
  payment_method   TEXT DEFAULT 'bank_transfer',
  currency         TEXT NOT NULL DEFAULT 'EUR',
  notes            TEXT,

  -- Schedule
  frequency        TEXT NOT NULL CHECK (frequency IN ('weekly', 'monthly', 'quarterly', 'yearly')),
  interval_count   INT NOT NULL DEFAULT 1,   -- every N frequency units
  day_of_month     INT CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 28)),
  next_run_at      DATE NOT NULL,
  last_run_at      DATE,
  end_date         DATE,                     -- NULL = indefinite

  -- Template items as JSONB array
  -- [{description, quantity, unit, unit_price_net, vat_rate}]
  items            JSONB NOT NULL DEFAULT '[]',

  -- Auto-send settings
  auto_send        BOOLEAN NOT NULL DEFAULT FALSE,
  send_to_email    TEXT,

  -- Tracking
  invoices_generated INT NOT NULL DEFAULT 0,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recurring_templates_org
  ON recurring_invoice_templates(organization_id);

CREATE INDEX IF NOT EXISTS idx_recurring_templates_active
  ON recurring_invoice_templates(is_active, next_run_at)
  WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS recurring_invoice_templates_updated_at ON recurring_invoice_templates;
CREATE TRIGGER recurring_invoice_templates_updated_at
  BEFORE UPDATE ON recurring_invoice_templates
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- RLS
-- =============================================================
ALTER TABLE recurring_invoice_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recurring_templates_select" ON recurring_invoice_templates;
CREATE POLICY "recurring_templates_select" ON recurring_invoice_templates FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

DROP POLICY IF EXISTS "recurring_templates_insert" ON recurring_invoice_templates;
CREATE POLICY "recurring_templates_insert" ON recurring_invoice_templates FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "recurring_templates_update" ON recurring_invoice_templates;
CREATE POLICY "recurring_templates_update" ON recurring_invoice_templates FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "recurring_templates_delete" ON recurring_invoice_templates;
CREATE POLICY "recurring_templates_delete" ON recurring_invoice_templates FOR DELETE
  USING (organization_id = ANY(get_user_organization_ids()));
