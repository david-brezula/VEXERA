-- =============================================================
-- Health Check Runs & Results
-- =============================================================
-- Tracks automated checks for document quality issues:
-- missing VAT, duplicates, unusual amounts, missing fields, etc.
-- Risk scoring per client for accountant dashboards.

CREATE TABLE IF NOT EXISTS health_check_runs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  triggered_by     UUID REFERENCES profiles(id),
  status           TEXT NOT NULL DEFAULT 'running'
                   CHECK (status IN ('running', 'completed', 'failed')),
  total_issues     INT DEFAULT 0,
  critical_count   INT DEFAULT 0,
  warning_count    INT DEFAULT 0,
  info_count       INT DEFAULT 0,
  completed_at     TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_check_runs_org
  ON health_check_runs(organization_id, created_at DESC);

-- =============================================================
-- RLS — Health Check Runs
-- =============================================================
ALTER TABLE health_check_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "health_check_runs_select" ON health_check_runs;
CREATE POLICY "health_check_runs_select" ON health_check_runs FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

DROP POLICY IF EXISTS "health_check_runs_insert" ON health_check_runs;
CREATE POLICY "health_check_runs_insert" ON health_check_runs FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "health_check_runs_update" ON health_check_runs;
CREATE POLICY "health_check_runs_update" ON health_check_runs FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));

-- =============================================================
-- Health Check Results
-- =============================================================

CREATE TABLE IF NOT EXISTS health_check_results (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  check_run_id     UUID NOT NULL REFERENCES health_check_runs(id) ON DELETE CASCADE,
  document_id      UUID REFERENCES documents(id) ON DELETE SET NULL,
  invoice_id       UUID REFERENCES invoices(id) ON DELETE SET NULL,
  check_type       TEXT NOT NULL
                   CHECK (check_type IN (
                     'missing_vat', 'duplicate_suspect', 'unusual_amount',
                     'missing_field', 'date_inconsistency', 'unmatched_payment',
                     'missing_category', 'supplier_mismatch'
                   )),
  severity         TEXT NOT NULL CHECK (severity IN ('critical', 'warning', 'info')),
  message          TEXT NOT NULL,
  details          JSONB DEFAULT '{}',
  resolved         BOOLEAN NOT NULL DEFAULT FALSE,
  resolved_at      TIMESTAMPTZ,
  resolved_by      UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_health_check_results_run
  ON health_check_results(organization_id, check_run_id);

CREATE INDEX IF NOT EXISTS idx_health_check_results_unresolved
  ON health_check_results(organization_id, resolved)
  WHERE resolved = FALSE;

CREATE INDEX IF NOT EXISTS idx_health_check_results_document
  ON health_check_results(document_id)
  WHERE document_id IS NOT NULL;

-- =============================================================
-- RLS — Health Check Results
-- =============================================================
ALTER TABLE health_check_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "health_check_results_select" ON health_check_results;
CREATE POLICY "health_check_results_select" ON health_check_results FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

DROP POLICY IF EXISTS "health_check_results_insert" ON health_check_results;
CREATE POLICY "health_check_results_insert" ON health_check_results FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "health_check_results_update" ON health_check_results;
CREATE POLICY "health_check_results_update" ON health_check_results FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));
