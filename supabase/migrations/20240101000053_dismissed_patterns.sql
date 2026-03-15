ALTER TABLE organizations ADD COLUMN IF NOT EXISTS dismissed_recurring_patterns JSONB DEFAULT '[]'::jsonb;
