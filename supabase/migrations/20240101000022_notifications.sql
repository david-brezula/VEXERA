-- =============================================================
-- In-App Notifications
-- =============================================================
-- Stores per-user, per-organization notifications.
-- Created by server actions / Edge Functions.
-- Users can mark them read; they are never deleted.
--
-- Notification types (stored in `type` column):
--   invoice_overdue       — invoice past due date
--   document_ocr_done     — OCR processing completed
--   document_ocr_failed   — OCR failed (needs manual entry)
--   bank_import_done      — bank statement import completed
--   reconciliation_match  — auto-match found (high confidence)
--   rule_applied          — rules engine changed a document/transaction
--   export_ready          — export file is ready for download
--   system               — general system message

CREATE TABLE IF NOT EXISTS notifications (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  type             TEXT NOT NULL,
  title            TEXT NOT NULL,
  body             TEXT,

  -- Optional deep-link to the related entity
  entity_type      TEXT,    -- e.g. "invoice", "document", "bank_transaction"
  entity_id        UUID,

  -- Optional structured payload for the UI (e.g. invoice amount, document name)
  metadata         JSONB,

  is_read          BOOLEAN NOT NULL DEFAULT FALSE,
  read_at          TIMESTAMPTZ,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_org
  ON notifications(user_id, organization_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_org
  ON notifications(organization_id);

-- =============================================================
-- RLS — each user sees only their own notifications
-- =============================================================
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "notifications_select" ON notifications;
CREATE POLICY "notifications_select" ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Only server-side (service role) may insert notifications
-- Users should NOT be able to create notifications for themselves
DROP POLICY IF EXISTS "notifications_insert" ON notifications;
CREATE POLICY "notifications_insert" ON notifications FOR INSERT
  WITH CHECK (
    organization_id = ANY(get_accessible_organization_ids())
    AND user_id = auth.uid()
  );

DROP POLICY IF EXISTS "notifications_update" ON notifications;
CREATE POLICY "notifications_update" ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Notifications are never deleted by users
