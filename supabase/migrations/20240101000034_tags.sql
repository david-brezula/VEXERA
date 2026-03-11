-- =============================================================
-- Tags — Client/Project/Custom Tagging System
-- =============================================================
-- Flexible tagging for documents, invoices, and ledger entries.
-- Enables P&L reporting by client or project dimension.

CREATE TABLE IF NOT EXISTS tags (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  tag_type         TEXT NOT NULL CHECK (tag_type IN ('client', 'project', 'custom')),
  color            TEXT,  -- hex color for UI display
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT tags_unique_name UNIQUE (organization_id, name, tag_type)
);

CREATE INDEX IF NOT EXISTS idx_tags_org ON tags(organization_id);

-- =============================================================
-- Entity Tags — Polymorphic junction table
-- =============================================================

CREATE TABLE IF NOT EXISTS entity_tags (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tag_id       UUID NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  entity_type  TEXT NOT NULL CHECK (entity_type IN ('document', 'invoice', 'ledger_entry')),
  entity_id    UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT entity_tags_unique UNIQUE (tag_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_entity_tags_entity
  ON entity_tags(entity_type, entity_id);

CREATE INDEX IF NOT EXISTS idx_entity_tags_tag
  ON entity_tags(tag_id);

-- =============================================================
-- RLS — Tags
-- =============================================================
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tags_select" ON tags;
CREATE POLICY "tags_select" ON tags FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

DROP POLICY IF EXISTS "tags_insert" ON tags;
CREATE POLICY "tags_insert" ON tags FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "tags_update" ON tags;
CREATE POLICY "tags_update" ON tags FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "tags_delete" ON tags;
CREATE POLICY "tags_delete" ON tags FOR DELETE
  USING (organization_id = ANY(get_user_organization_ids()));

-- =============================================================
-- RLS — Entity Tags (via tag's org scope)
-- =============================================================
ALTER TABLE entity_tags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entity_tags_select" ON entity_tags;
CREATE POLICY "entity_tags_select" ON entity_tags FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tags
      WHERE tags.id = entity_tags.tag_id
      AND tags.organization_id = ANY(get_accessible_organization_ids())
    )
  );

DROP POLICY IF EXISTS "entity_tags_insert" ON entity_tags;
CREATE POLICY "entity_tags_insert" ON entity_tags FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tags
      WHERE tags.id = entity_tags.tag_id
      AND tags.organization_id = ANY(get_user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "entity_tags_delete" ON entity_tags;
CREATE POLICY "entity_tags_delete" ON entity_tags FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tags
      WHERE tags.id = entity_tags.tag_id
      AND tags.organization_id = ANY(get_user_organization_ids())
    )
  );
