-- =============================================================
-- Categorization Rules (IF-THEN Engine)
-- =============================================================
-- Rules define automatic categorization / tagging of documents
-- and bank transactions based on configurable conditions.
--
-- conditions: array of {field, operator, value}
--   e.g. [{"field":"supplier_name","operator":"contains","value":"Telekom"}]
--
-- actions: array of {type, value}
--   e.g. [{"type":"set_category","value":"telecommunications"},
--          {"type":"set_account","value":"518"}]
--
-- Supported operators: equals, not_equals, contains, not_contains,
--                       starts_with, ends_with, gt, lt, gte, lte
--
-- Supported action types: set_category, set_account,
--                          set_document_type, set_tag

CREATE TABLE IF NOT EXISTS rules (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  name           TEXT NOT NULL,
  description    TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  priority       INTEGER NOT NULL DEFAULT 100,    -- lower number = applied first

  -- Target entity: 'document' or 'bank_transaction'
  target_entity  TEXT NOT NULL DEFAULT 'document'
                   CHECK (target_entity IN ('document', 'bank_transaction')),

  conditions     JSONB NOT NULL DEFAULT '[]',     -- RuleCondition[]
  actions        JSONB NOT NULL DEFAULT '[]',     -- RuleAction[]

  -- Stats
  applied_count  INTEGER NOT NULL DEFAULT 0,
  last_applied_at TIMESTAMPTZ,

  created_by     UUID REFERENCES profiles(id),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rules_org        ON rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_rules_active     ON rules(organization_id, is_active, priority)
  WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_rules_target     ON rules(organization_id, target_entity);

DROP TRIGGER IF EXISTS rules_updated_at ON rules;
CREATE TRIGGER rules_updated_at
  BEFORE UPDATE ON rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================================
-- Rule Application Log
-- =============================================================
-- Immutable record: which rule was applied to which entity and when.

CREATE TABLE IF NOT EXISTS rule_applications (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id         UUID NOT NULL REFERENCES rules(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('document', 'bank_transaction')),
  entity_id       UUID NOT NULL,
  actions_applied JSONB NOT NULL,               -- snapshot of what was changed
  applied_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_rule_apps_rule   ON rule_applications(rule_id);
CREATE INDEX IF NOT EXISTS idx_rule_apps_entity ON rule_applications(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_rule_apps_org    ON rule_applications(organization_id);

-- =============================================================
-- RLS — rules
-- =============================================================
ALTER TABLE rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rules_select" ON rules;
CREATE POLICY "rules_select" ON rules FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

DROP POLICY IF EXISTS "rules_insert" ON rules;
CREATE POLICY "rules_insert" ON rules FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "rules_update" ON rules;
CREATE POLICY "rules_update" ON rules FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "rules_delete" ON rules;
CREATE POLICY "rules_delete" ON rules FOR DELETE
  USING (organization_id = ANY(get_user_organization_ids()));

-- =============================================================
-- RLS — rule_applications (read-only, INSERT via service role)
-- =============================================================
ALTER TABLE rule_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rule_applications_select" ON rule_applications;
CREATE POLICY "rule_applications_select" ON rule_applications FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));
