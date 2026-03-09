-- Add workflow status column and extracted OCR fields to documents table.
-- Status state machine: new → auto_processed → awaiting_review → approved → awaiting_client → archived

ALTER TABLE documents
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'new'
    CHECK (status IN ('new','auto_processed','awaiting_review','approved','awaiting_client','archived')),
  ADD COLUMN IF NOT EXISTS supplier_name     TEXT,
  ADD COLUMN IF NOT EXISTS document_number   TEXT,
  ADD COLUMN IF NOT EXISTS issue_date        DATE,
  ADD COLUMN IF NOT EXISTS due_date          DATE,
  ADD COLUMN IF NOT EXISTS total_amount      NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS vat_amount        NUMERIC(15,2),
  ADD COLUMN IF NOT EXISTS vat_rate          NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS category          TEXT;

CREATE INDEX IF NOT EXISTS idx_documents_status ON documents(status);

-- Add document_comments table
CREATE TABLE IF NOT EXISTS document_comments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id      UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          UUID REFERENCES profiles(id),
  content          TEXT NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_document_comments_doc ON document_comments(document_id);

ALTER TABLE document_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Org members can manage document comments"
  ON document_comments
  FOR ALL
  USING (
    organization_id IN (
      SELECT om.organization_id FROM organization_members om WHERE om.user_id = auth.uid()
    )
  );
