ALTER TABLE freelancer_profiles
  ADD COLUMN is_student BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN is_pensioner BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN has_other_employment BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN paid_health_monthly DECIMAL(10,2);
