-- =============================================================
-- Email Connections
-- Stores Gmail OAuth2 tokens per organization.
-- One organization can have multiple connected inboxes.
-- =============================================================

CREATE TABLE IF NOT EXISTS email_connections (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by       UUID REFERENCES profiles(id) ON DELETE SET NULL,

  -- Gmail identity
  email_address    TEXT NOT NULL,
  google_user_id   TEXT NOT NULL,  -- stable Google sub ID for dedup

  -- OAuth2 tokens (stored as text; encrypt at app layer or use Vault in production)
  access_token     TEXT NOT NULL,
  refresh_token    TEXT NOT NULL,
  token_expires_at TIMESTAMPTZ NOT NULL,

  -- State
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  last_polled_at   TIMESTAMPTZ,
  last_error       TEXT,         -- last polling error message, if any

  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- One Gmail account per organization (enforce via unique constraint)
  UNIQUE (organization_id, google_user_id)
);

CREATE INDEX IF NOT EXISTS idx_email_connections_org
  ON email_connections(organization_id);

CREATE INDEX IF NOT EXISTS idx_email_connections_active
  ON email_connections(is_active)
  WHERE is_active = TRUE;

DROP TRIGGER IF EXISTS email_connections_updated_at ON email_connections;
CREATE TRIGGER email_connections_updated_at
  BEFORE UPDATE ON email_connections
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- Email Imports
-- Tracks which Gmail messages + attachments have been processed.
-- Used for duplicate detection across polling runs.
-- =============================================================

CREATE TABLE IF NOT EXISTS email_imports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email_connection_id   UUID NOT NULL REFERENCES email_connections(id) ON DELETE CASCADE,

  -- Gmail message identifiers
  gmail_message_id      TEXT NOT NULL,   -- Gmail API messageId
  gmail_thread_id       TEXT,

  -- Email metadata
  subject               TEXT,
  sender                TEXT,
  received_at           TIMESTAMPTZ,

  -- Processing result
  attachments_found     INT NOT NULL DEFAULT 0,
  documents_created     INT NOT NULL DEFAULT 0,
  processed_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error_message         TEXT,   -- null = success

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Never process the same message twice per org
  UNIQUE (organization_id, gmail_message_id)
);

CREATE INDEX IF NOT EXISTS idx_email_imports_org
  ON email_imports(organization_id);

CREATE INDEX IF NOT EXISTS idx_email_imports_connection
  ON email_imports(email_connection_id);

-- =============================================================
-- RLS
-- =============================================================

ALTER TABLE email_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_connections_select" ON email_connections;
CREATE POLICY "email_connections_select" ON email_connections FOR SELECT
  USING (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "email_connections_insert" ON email_connections;
CREATE POLICY "email_connections_insert" ON email_connections FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "email_connections_update" ON email_connections;
CREATE POLICY "email_connections_update" ON email_connections FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "email_connections_delete" ON email_connections;
CREATE POLICY "email_connections_delete" ON email_connections FOR DELETE
  USING (organization_id = ANY(get_user_organization_ids()));

ALTER TABLE email_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_imports_select" ON email_imports;
CREATE POLICY "email_imports_select" ON email_imports FOR SELECT
  USING (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "email_imports_insert" ON email_imports;
CREATE POLICY "email_imports_insert" ON email_imports FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));
