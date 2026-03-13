-- Migrate vat_returns from quarterly to monthly granularity
-- Add filing_frequency to organizations

-- Add period_month column
ALTER TABLE vat_returns ADD COLUMN period_month SMALLINT;

-- Populate period_month from period_quarter (use first month of quarter)
UPDATE vat_returns SET period_month = (period_quarter - 1) * 3 + 1;

-- Make period_month NOT NULL
ALTER TABLE vat_returns ALTER COLUMN period_month SET NOT NULL;

-- Add check constraint
ALTER TABLE vat_returns ADD CONSTRAINT chk_vat_returns_month
  CHECK (period_month BETWEEN 1 AND 12);

-- Drop old unique constraint and create new one
ALTER TABLE vat_returns DROP CONSTRAINT IF EXISTS vat_returns_organization_id_period_year_period_quarter_key;
ALTER TABLE vat_returns ADD CONSTRAINT vat_returns_org_year_month_key
  UNIQUE (organization_id, period_year, period_month);

-- Drop period_quarter column
ALTER TABLE vat_returns DROP COLUMN period_quarter;

-- Add filing_frequency to organizations
ALTER TABLE organizations ADD COLUMN filing_frequency TEXT
  NOT NULL DEFAULT 'quarterly'
  CHECK (filing_frequency IN ('monthly', 'quarterly'));

-- Add index for period lookups
CREATE INDEX idx_vat_returns_period ON vat_returns(organization_id, period_year, period_month);
