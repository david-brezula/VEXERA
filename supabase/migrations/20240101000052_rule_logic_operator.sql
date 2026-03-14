ALTER TABLE rules ADD COLUMN IF NOT EXISTS logic_operator TEXT NOT NULL DEFAULT 'AND';
ALTER TABLE rules ADD CONSTRAINT rules_logic_operator_check CHECK (logic_operator IN ('AND', 'OR'));
