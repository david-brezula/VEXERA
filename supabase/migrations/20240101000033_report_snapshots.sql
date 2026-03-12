-- =============================================================
-- Report Snapshots — Cached Report Data
-- =============================================================
-- Stores pre-computed report data (category breakdowns, P&L, etc.)
-- to enable fast loading and historical comparison.

CREATE TABLE IF NOT EXISTS report_snapshots (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  report_type      TEXT NOT NULL
                   CHECK (report_type IN ('category_breakdown', 'client_pl', 'project_pl', 'remaining_work')),
  period_from      DATE NOT NULL,
  period_to        DATE NOT NULL,
  parameters       JSONB DEFAULT '{}',
  data             JSONB NOT NULL,
  generated_by     UUID REFERENCES profiles(id),
  generated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_report_snapshots_lookup
  ON report_snapshots(organization_id, report_type, period_from);

-- =============================================================
-- RLS
-- =============================================================
ALTER TABLE report_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "report_snapshots_select" ON report_snapshots;
CREATE POLICY "report_snapshots_select" ON report_snapshots FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

DROP POLICY IF EXISTS "report_snapshots_insert" ON report_snapshots;
CREATE POLICY "report_snapshots_insert" ON report_snapshots FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "report_snapshots_delete" ON report_snapshots;
CREATE POLICY "report_snapshots_delete" ON report_snapshots FOR DELETE
  USING (organization_id = ANY(get_user_organization_ids()));
