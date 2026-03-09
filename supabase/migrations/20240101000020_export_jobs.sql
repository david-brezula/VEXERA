-- =============================================================
-- Export Jobs
-- =============================================================
-- Async export requests. Generating a Pohoda/Money CSV for a
-- full accounting period can take seconds — so it's queued here,
-- processed by an Edge Function, and the result file stored in S3.

CREATE TABLE IF NOT EXISTS export_jobs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  created_by      UUID REFERENCES profiles(id),

  -- What to export
  format          TEXT NOT NULL CHECK (format IN ('pohoda', 'money_s3', 'kros', 'csv_generic')),
  period_from     DATE NOT NULL,
  period_to       DATE NOT NULL,
  include_types   TEXT[] NOT NULL DEFAULT '{}',  -- empty = all types

  -- Execution state
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'processing', 'done', 'failed')),
  started_at      TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  error_message   TEXT,

  -- Result
  file_path       TEXT,                           -- S3 key of generated file
  row_count       INTEGER,                        -- number of ledger entries exported

  -- Metadata
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT export_jobs_period_valid CHECK (period_from <= period_to)
);

CREATE INDEX IF NOT EXISTS idx_export_jobs_org    ON export_jobs(organization_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_status ON export_jobs(status) WHERE status IN ('pending', 'processing');

DROP TRIGGER IF EXISTS export_jobs_updated_at ON export_jobs;
CREATE TRIGGER export_jobs_updated_at
  BEFORE UPDATE ON export_jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- RLS
-- =============================================================
ALTER TABLE export_jobs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "export_jobs_select" ON export_jobs;
CREATE POLICY "export_jobs_select" ON export_jobs FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

DROP POLICY IF EXISTS "export_jobs_insert" ON export_jobs;
CREATE POLICY "export_jobs_insert" ON export_jobs FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

-- Only the creator or an admin can cancel/delete
DROP POLICY IF EXISTS "export_jobs_update" ON export_jobs;
CREATE POLICY "export_jobs_update" ON export_jobs FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));
