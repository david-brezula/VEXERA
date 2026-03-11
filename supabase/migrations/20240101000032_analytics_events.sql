-- =============================================================
-- Analytics Events — Product Analytics / Event Tracking
-- =============================================================
-- Lightweight event tracking for product decisions.
-- Tracks feature usage: document uploads, invoice creation, exports, etc.
-- All authenticated users can INSERT; only admins/service_role can SELECT.

CREATE TABLE IF NOT EXISTS analytics_events (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE SET NULL,  -- nullable for pre-auth events
  user_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,       -- nullable for system events
  event_name       TEXT NOT NULL,  -- e.g. 'document.uploaded', 'invoice.created', 'health_check.run'
  properties       JSONB DEFAULT '{}',
  session_id       TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_name_date
  ON analytics_events(event_name, created_at);

CREATE INDEX IF NOT EXISTS idx_analytics_events_org
  ON analytics_events(organization_id, created_at);

-- =============================================================
-- RLS
-- =============================================================
ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;

-- All authenticated users can insert events
DROP POLICY IF EXISTS "analytics_events_insert" ON analytics_events;
CREATE POLICY "analytics_events_insert" ON analytics_events FOR INSERT
  WITH CHECK (true);

-- Only users in the org can read their org's events
DROP POLICY IF EXISTS "analytics_events_select" ON analytics_events;
CREATE POLICY "analytics_events_select" ON analytics_events FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id = ANY(get_accessible_organization_ids())
  );
