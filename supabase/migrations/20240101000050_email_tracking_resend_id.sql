-- Add resend_id column to email_tracking
-- Stores the Resend email ID for webhook-based delivery status updates.

ALTER TABLE public.email_tracking ADD COLUMN IF NOT EXISTS resend_id TEXT;

CREATE INDEX IF NOT EXISTS idx_email_tracking_resend_id
  ON public.email_tracking(resend_id);
