-- =============================================================
-- Job Queue
-- =============================================================
-- Generic async job queue for background processing.
-- Used by: recurring invoices, ML retraining, export generation,
-- AI chatbot, health checks, email tracking, archive retention.
--
-- Workers pick jobs via SELECT ... FOR UPDATE SKIP LOCKED
-- to allow safe concurrent processing.

CREATE TABLE IF NOT EXISTS job_queue (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- nullable for system-wide jobs
  job_type         TEXT NOT NULL,  -- e.g. 'recurring_invoice', 'health_check', 'ml_retrain', 'export', 'ai_query'
  payload          JSONB NOT NULL DEFAULT '{}',
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending', 'processing', 'done', 'failed', 'cancelled')),
  priority         INT NOT NULL DEFAULT 0,  -- lower = higher priority
  attempts         INT NOT NULL DEFAULT 0,
  max_attempts     INT NOT NULL DEFAULT 3,
  scheduled_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  started_at       TIMESTAMPTZ,
  completed_at     TIMESTAMPTZ,
  error_message    TEXT,
  result           JSONB,
  created_by       UUID REFERENCES profiles(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for worker polling: find pending/processing jobs efficiently
CREATE INDEX IF NOT EXISTS idx_job_queue_pending
  ON job_queue(status, priority, scheduled_at)
  WHERE status IN ('pending', 'processing');

CREATE INDEX IF NOT EXISTS idx_job_queue_org ON job_queue(organization_id);
CREATE INDEX IF NOT EXISTS idx_job_queue_type ON job_queue(job_type, status);

DROP TRIGGER IF EXISTS job_queue_updated_at ON job_queue;
CREATE TRIGGER job_queue_updated_at
  BEFORE UPDATE ON job_queue
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- RLS
-- =============================================================
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;

-- SELECT: users can see jobs for their orgs, or system jobs (org_id IS NULL)
DROP POLICY IF EXISTS "job_queue_select" ON job_queue;
CREATE POLICY "job_queue_select" ON job_queue FOR SELECT
  USING (
    organization_id IS NULL
    OR organization_id = ANY(get_accessible_organization_ids())
  );

-- INSERT: users can create jobs for their own orgs
DROP POLICY IF EXISTS "job_queue_insert" ON job_queue;
CREATE POLICY "job_queue_insert" ON job_queue FOR INSERT
  WITH CHECK (
    organization_id IS NULL
    OR organization_id = ANY(get_user_organization_ids())
  );

-- UPDATE: users can update jobs for their own orgs (e.g. cancel)
DROP POLICY IF EXISTS "job_queue_update" ON job_queue;
CREATE POLICY "job_queue_update" ON job_queue FOR UPDATE
  USING (
    organization_id IS NULL
    OR organization_id = ANY(get_user_organization_ids())
  );

-- DELETE: users can delete jobs for their own orgs
DROP POLICY IF EXISTS "job_queue_delete" ON job_queue;
CREATE POLICY "job_queue_delete" ON job_queue FOR DELETE
  USING (
    organization_id IS NULL
    OR organization_id = ANY(get_user_organization_ids())
  );
