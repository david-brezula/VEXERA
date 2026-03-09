-- Document corrections table: tracks accountant edits to OCR-extracted fields.
-- Used by the smart categorization service to learn from corrections and
-- improve auto-categorization over time.

CREATE TABLE IF NOT EXISTS document_corrections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES profiles(id),
  field_name       TEXT NOT NULL,           -- e.g. 'category', 'supplier_name', 'account_number'
  old_value        TEXT,                    -- value before correction (from OCR / rules)
  new_value        TEXT NOT NULL,           -- corrected value by accountant
  source           TEXT NOT NULL DEFAULT 'manual',  -- 'ocr', 'rule', 'manual'
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_corrections_org   ON document_corrections(organization_id);
CREATE INDEX idx_document_corrections_doc   ON document_corrections(document_id);
CREATE INDEX idx_document_corrections_field ON document_corrections(field_name, new_value);

ALTER TABLE document_corrections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage document corrections"
  ON document_corrections
  FOR ALL
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
    )
  );

-- Add account_number column to documents for GL account assignment
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS account_number TEXT,
  ADD COLUMN IF NOT EXISTS tag           TEXT,
  ADD COLUMN IF NOT EXISTS auto_categorized BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS confidence_score NUMERIC(3,2);  -- 0.00 to 1.00

-- Document hash for duplicate detection
ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS file_hash TEXT;

CREATE INDEX idx_documents_file_hash ON documents(file_hash) WHERE file_hash IS NOT NULL;
