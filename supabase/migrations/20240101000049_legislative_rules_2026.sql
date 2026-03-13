-- Legislative rules updates for 2026
-- VAT rates (23%, 19%, 5%, 0%) already seeded in migration 000030.
-- This migration adds monthly VAT deadlines for 2026 and updates filing requirements.

-- Add monthly VAT deadlines for 2026 (for monthly filers)
INSERT INTO legislative_rules (country_code, rule_type, key, value, valid_from, description) VALUES
  ('SK', 'tax_deadline', 'vat_m01_2026', '{"date": "2026-02-25", "period": "01/2026"}', '2026-01-01', 'DPH za január 2026'),
  ('SK', 'tax_deadline', 'vat_m02_2026', '{"date": "2026-03-25", "period": "02/2026"}', '2026-02-01', 'DPH za február 2026'),
  ('SK', 'tax_deadline', 'vat_m03_2026', '{"date": "2026-04-25", "period": "03/2026"}', '2026-03-01', 'DPH za marec 2026'),
  ('SK', 'tax_deadline', 'vat_m04_2026', '{"date": "2026-05-25", "period": "04/2026"}', '2026-04-01', 'DPH za apríl 2026'),
  ('SK', 'tax_deadline', 'vat_m05_2026', '{"date": "2026-06-25", "period": "05/2026"}', '2026-05-01', 'DPH za máj 2026'),
  ('SK', 'tax_deadline', 'vat_m06_2026', '{"date": "2026-07-25", "period": "06/2026"}', '2026-06-01', 'DPH za jún 2026'),
  ('SK', 'tax_deadline', 'vat_m07_2026', '{"date": "2026-08-25", "period": "07/2026"}', '2026-07-01', 'DPH za júl 2026'),
  ('SK', 'tax_deadline', 'vat_m08_2026', '{"date": "2026-09-25", "period": "08/2026"}', '2026-08-01', 'DPH za august 2026'),
  ('SK', 'tax_deadline', 'vat_m09_2026', '{"date": "2026-10-25", "period": "09/2026"}', '2026-09-01', 'DPH za september 2026'),
  ('SK', 'tax_deadline', 'vat_m10_2026', '{"date": "2026-11-25", "period": "10/2026"}', '2026-10-01', 'DPH za október 2026'),
  ('SK', 'tax_deadline', 'vat_m11_2026', '{"date": "2026-12-25", "period": "11/2026"}', '2026-11-01', 'DPH za november 2026'),
  ('SK', 'tax_deadline', 'vat_m12_2026', '{"date": "2027-01-25", "period": "12/2026"}', '2026-12-01', 'DPH za december 2026')
ON CONFLICT (country_code, rule_type, key, valid_from) DO NOTHING;

-- Update filing requirements to support both monthly and quarterly frequency
UPDATE legislative_rules
  SET value = '{"frequency": "monthly_or_quarterly", "required_for": "vat_payer"}'
  WHERE country_code = 'SK'
    AND rule_type = 'filing_requirement'
    AND key = 'vat_return';

UPDATE legislative_rules
  SET value = '{"frequency": "monthly_or_quarterly", "required_for": "vat_payer"}'
  WHERE country_code = 'SK'
    AND rule_type = 'filing_requirement'
    AND key = 'vat_control_stmt';
