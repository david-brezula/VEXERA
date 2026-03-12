-- =============================================================
-- Legislative Rules — System Reference Data
-- =============================================================
-- Centralized table for VAT rates, retention periods, tax deadlines,
-- and filing requirements by country/jurisdiction.
-- Used by: health checks, electronic archive, reports, VAT service.
--
-- This is system-wide reference data — no organization_id.
-- Only service_role can INSERT/UPDATE; all authenticated users can SELECT.

CREATE TABLE IF NOT EXISTS legislative_rules (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code TEXT NOT NULL DEFAULT 'SK',
  rule_type    TEXT NOT NULL
               CHECK (rule_type IN ('vat_rate', 'retention_period', 'tax_deadline', 'filing_requirement')),
  key          TEXT NOT NULL,          -- e.g. 'standard_vat', 'invoice_retention', 'vat_filing_q1'
  value        JSONB NOT NULL,         -- flexible: {rate: 20}, {years: 10}, {date: "2026-04-25"}
  valid_from   DATE NOT NULL,
  valid_to     DATE,                   -- NULL = currently active
  description  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT legislative_rules_unique UNIQUE (country_code, rule_type, key, valid_from)
);

CREATE INDEX IF NOT EXISTS idx_legislative_rules_lookup
  ON legislative_rules(country_code, rule_type, valid_from);

-- =============================================================
-- RLS — Read-only for users, write for service_role
-- =============================================================
ALTER TABLE legislative_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "legislative_rules_select" ON legislative_rules;
CREATE POLICY "legislative_rules_select" ON legislative_rules FOR SELECT
  USING (true);  -- all authenticated users can read

-- INSERT/UPDATE/DELETE only via service_role (migrations, admin scripts)
-- No user-facing write policies needed

-- =============================================================
-- Seed: Slovak Legislative Rules (as of 2026)
-- =============================================================

-- VAT Rates
INSERT INTO legislative_rules (country_code, rule_type, key, value, valid_from, description) VALUES
  ('SK', 'vat_rate', 'standard',  '{"rate": 23}',  '2025-01-01', 'Základná sadzba DPH 23%'),
  ('SK', 'vat_rate', 'reduced_1', '{"rate": 19}',  '2025-01-01', 'Znížená sadzba DPH 19% (potraviny, nápoje)'),
  ('SK', 'vat_rate', 'reduced_2', '{"rate": 5}',   '2025-01-01', 'Znížená sadzba DPH 5% (knihy, lieky, špec. potraviny)'),
  ('SK', 'vat_rate', 'zero',      '{"rate": 0}',   '2020-01-01', 'Nulová sadzba DPH'),
  -- Historical rates (valid_to set)
  ('SK', 'vat_rate', 'standard',  '{"rate": 20}',  '2011-01-01', 'Základná sadzba DPH 20% (historická)')
ON CONFLICT (country_code, rule_type, key, valid_from) DO NOTHING;

-- Set valid_to for historical rate
UPDATE legislative_rules
  SET valid_to = '2024-12-31'
  WHERE country_code = 'SK' AND rule_type = 'vat_rate' AND key = 'standard' AND valid_from = '2011-01-01';

-- Retention Periods
INSERT INTO legislative_rules (country_code, rule_type, key, value, valid_from, description) VALUES
  ('SK', 'retention_period', 'invoice',          '{"years": 10}', '2020-01-01', 'Faktúry — 10 rokov'),
  ('SK', 'retention_period', 'bank_statement',   '{"years": 10}', '2020-01-01', 'Bankové výpisy — 10 rokov'),
  ('SK', 'retention_period', 'receipt',           '{"years": 5}',  '2020-01-01', 'Pokladničné doklady — 5 rokov'),
  ('SK', 'retention_period', 'contract',          '{"years": 10}', '2020-01-01', 'Zmluvy — 10 rokov'),
  ('SK', 'retention_period', 'payroll',           '{"years": 10}', '2020-01-01', 'Mzdové doklady — 10 rokov'),
  ('SK', 'retention_period', 'tax_return',        '{"years": 10}', '2020-01-01', 'Daňové priznania — 10 rokov'),
  ('SK', 'retention_period', 'accounting_journal','{"years": 10}', '2020-01-01', 'Účtovný denník — 10 rokov'),
  ('SK', 'retention_period', 'correspondence',    '{"years": 5}',  '2020-01-01', 'Obchodná korešpondencia — 5 rokov')
ON CONFLICT (country_code, rule_type, key, valid_from) DO NOTHING;

-- Tax Deadlines (2026 schedule — quarterly VAT filer)
INSERT INTO legislative_rules (country_code, rule_type, key, value, valid_from, description) VALUES
  ('SK', 'tax_deadline', 'vat_q1_2026',  '{"date": "2026-04-25", "period": "Q1 2026"}', '2026-01-01', 'DPH za Q1 2026'),
  ('SK', 'tax_deadline', 'vat_q2_2026',  '{"date": "2026-07-25", "period": "Q2 2026"}', '2026-04-01', 'DPH za Q2 2026'),
  ('SK', 'tax_deadline', 'vat_q3_2026',  '{"date": "2026-10-25", "period": "Q3 2026"}', '2026-07-01', 'DPH za Q3 2026'),
  ('SK', 'tax_deadline', 'vat_q4_2026',  '{"date": "2027-01-25", "period": "Q4 2026"}', '2026-10-01', 'DPH za Q4 2026'),
  ('SK', 'tax_deadline', 'dppo_2025',    '{"date": "2026-03-31", "period": "2025"}',     '2026-01-01', 'Daň z príjmu PO za 2025'),
  ('SK', 'tax_deadline', 'dpfo_2025',    '{"date": "2026-03-31", "period": "2025"}',     '2026-01-01', 'Daň z príjmu FO za 2025')
ON CONFLICT (country_code, rule_type, key, valid_from) DO NOTHING;

-- Filing Requirements
INSERT INTO legislative_rules (country_code, rule_type, key, value, valid_from, description) VALUES
  ('SK', 'filing_requirement', 'vat_return',         '{"frequency": "quarterly", "required_for": "vat_payer"}',     '2020-01-01', 'Daňové priznanie k DPH'),
  ('SK', 'filing_requirement', 'vat_control_stmt',   '{"frequency": "quarterly", "required_for": "vat_payer"}',     '2020-01-01', 'Kontrolný výkaz DPH'),
  ('SK', 'filing_requirement', 'vat_summary_stmt',   '{"frequency": "quarterly", "required_for": "eu_trader"}',     '2020-01-01', 'Súhrnný výkaz DPH'),
  ('SK', 'filing_requirement', 'income_tax_return',   '{"frequency": "yearly", "required_for": "all"}',             '2020-01-01', 'Daňové priznanie k dani z príjmu'),
  ('SK', 'filing_requirement', 'financial_statements','{"frequency": "yearly", "required_for": "double_entry"}',    '2020-01-01', 'Účtovná závierka')
ON CONFLICT (country_code, rule_type, key, valid_from) DO NOTHING;
