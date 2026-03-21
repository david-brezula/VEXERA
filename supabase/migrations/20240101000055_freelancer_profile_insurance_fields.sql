-- Add insurance and first-year fields to freelancer_profiles
-- Required for accurate Slovak tax calculations (2026 law)

ALTER TABLE freelancer_profiles
  ADD COLUMN is_first_year BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN founding_date DATE,
  ADD COLUMN has_social_insurance BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN paid_social_monthly DECIMAL(10,2),
  ADD COLUMN is_disabled BOOLEAN NOT NULL DEFAULT false;

-- Constraint: founding_date required when is_first_year = true
ALTER TABLE freelancer_profiles
  ADD CONSTRAINT chk_founding_date_required
  CHECK (is_first_year = false OR founding_date IS NOT NULL);
