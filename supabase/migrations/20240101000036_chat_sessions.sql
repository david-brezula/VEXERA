-- =============================================================
-- Chat Sessions & Messages — AI Chatbot
-- =============================================================
-- Stores conversation history for the AI-powered chatbot.
-- Users can ask natural language questions about their financial data.

CREATE TABLE IF NOT EXISTS chat_sessions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title            TEXT,  -- auto-generated from first message
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user
  ON chat_sessions(organization_id, user_id, created_at DESC);

DROP TRIGGER IF EXISTS chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- Chat Messages
-- =============================================================

CREATE TABLE IF NOT EXISTS chat_messages (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content      TEXT NOT NULL,
  metadata     JSONB DEFAULT '{}',  -- sources, SQL queries used, confidence
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session
  ON chat_messages(session_id, created_at);

-- =============================================================
-- RLS — Chat Sessions (user + org scoped)
-- =============================================================
ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_sessions_select" ON chat_sessions;
CREATE POLICY "chat_sessions_select" ON chat_sessions FOR SELECT
  USING (
    user_id = (SELECT auth.uid())
    AND organization_id = ANY(get_accessible_organization_ids())
  );

DROP POLICY IF EXISTS "chat_sessions_insert" ON chat_sessions;
CREATE POLICY "chat_sessions_insert" ON chat_sessions FOR INSERT
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND organization_id = ANY(get_user_organization_ids())
  );

DROP POLICY IF EXISTS "chat_sessions_delete" ON chat_sessions;
CREATE POLICY "chat_sessions_delete" ON chat_sessions FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- =============================================================
-- RLS — Chat Messages (via session scope)
-- =============================================================
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "chat_messages_select" ON chat_messages;
CREATE POLICY "chat_messages_select" ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
      AND chat_sessions.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS "chat_messages_insert" ON chat_messages;
CREATE POLICY "chat_messages_insert" ON chat_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM chat_sessions
      WHERE chat_sessions.id = chat_messages.session_id
      AND chat_sessions.user_id = (SELECT auth.uid())
    )
  );
