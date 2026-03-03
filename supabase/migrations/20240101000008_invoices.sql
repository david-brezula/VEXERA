CREATE TABLE IF NOT EXISTS invoices (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_number       TEXT NOT NULL,
  invoice_type         TEXT NOT NULL CHECK (invoice_type IN ('issued', 'received')),
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','sent','paid','overdue','cancelled','closed')),
  supplier_name        TEXT NOT NULL,
  supplier_ico         TEXT,
  supplier_dic         TEXT,
  supplier_ic_dph      TEXT,
  supplier_address     TEXT,
  supplier_iban        TEXT,
  customer_name        TEXT NOT NULL,
  customer_ico         TEXT,
  customer_dic         TEXT,
  customer_ic_dph      TEXT,
  customer_address     TEXT,
  issue_date           DATE NOT NULL,
  delivery_date        DATE,
  due_date             DATE NOT NULL,
  paid_at              TIMESTAMPTZ,
  subtotal             DECIMAL(15,2) NOT NULL DEFAULT 0,
  vat_amount           DECIMAL(15,2) NOT NULL DEFAULT 0,
  total                DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency             TEXT NOT NULL DEFAULT 'EUR',
  payment_method       TEXT CHECK (payment_method IN ('bank_transfer','cash','card','other')),
  bank_iban            TEXT,
  variable_symbol      TEXT,
  constant_symbol      TEXT,
  specific_symbol      TEXT,
  notes                TEXT,
  internal_notes       TEXT,
  file_path            TEXT,
  file_url             TEXT,
  peppol_id            TEXT,
  peppol_status        TEXT CHECK (peppol_status IN ('not_sent','pending','delivered','failed')),
  peppol_sent_at       TIMESTAMPTZ,
  closed_by            UUID REFERENCES profiles(id),
  closed_at            TIMESTAMPTZ,
  created_by           UUID REFERENCES profiles(id),
  updated_by           UUID REFERENCES profiles(id),
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, invoice_number, invoice_type)
);

CREATE INDEX IF NOT EXISTS idx_invoices_org        ON invoices(organization_id);
CREATE INDEX IF NOT EXISTS idx_invoices_status     ON invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date   ON invoices(due_date);
CREATE INDEX IF NOT EXISTS idx_invoices_type       ON invoices(invoice_type);

DROP TRIGGER IF EXISTS invoices_updated_at ON invoices;
CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
