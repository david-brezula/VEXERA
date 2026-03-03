CREATE TABLE IF NOT EXISTS documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id       UUID REFERENCES invoices(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  file_path        TEXT NOT NULL,
  file_size_bytes  BIGINT,
  mime_type        TEXT,
  checksum_sha256  TEXT,
  document_type    TEXT CHECK (document_type IN (
    'invoice_issued','invoice_received','receipt',
    'contract','bank_statement','tax_document','other'
  )),
  retention_until  DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '10 years'),
  is_archived      BOOLEAN NOT NULL DEFAULT FALSE,
  ocr_status       TEXT NOT NULL DEFAULT 'not_queued'
                     CHECK (ocr_status IN ('not_queued','queued','processing','done','failed')),
  ocr_data         JSONB,
  ocr_processed_at TIMESTAMPTZ,
  uploaded_by      UUID REFERENCES profiles(id),
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_documents_org     ON documents(organization_id);
CREATE INDEX IF NOT EXISTS idx_documents_invoice ON documents(invoice_id);
CREATE INDEX IF NOT EXISTS idx_documents_type    ON documents(document_type);

DROP TRIGGER IF EXISTS documents_updated_at ON documents;
CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
