-- =============================================================
-- RLS Helper Functions
-- =============================================================

-- Returns organization IDs where the current user is a direct member
CREATE OR REPLACE FUNCTION get_user_organization_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT organization_id FROM organization_members
      WHERE user_id = auth.uid()
      AND organization_id IN (
        SELECT id FROM organizations WHERE deleted_at IS NULL
      )
    ),
    '{}'::UUID[]
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns organization IDs where the current user is an active accountant
CREATE OR REPLACE FUNCTION get_accountant_organization_ids()
RETURNS UUID[] AS $$
  SELECT COALESCE(
    ARRAY(
      SELECT organization_id FROM accountant_clients
      WHERE accountant_id = auth.uid() AND status = 'active'
    ),
    '{}'::UUID[]
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns ALL organization IDs the current user can access (member + accountant)
CREATE OR REPLACE FUNCTION get_accessible_organization_ids()
RETURNS UUID[] AS $$
  SELECT array_cat(
    get_user_organization_ids(),
    get_accountant_organization_ids()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =============================================================
-- PROFILES
-- =============================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select" ON profiles;
CREATE POLICY "profiles_select" ON profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update" ON profiles;
CREATE POLICY "profiles_update" ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- Allow users to see profiles of other members in their organizations
DROP POLICY IF EXISTS "profiles_select_org_members" ON profiles;
CREATE POLICY "profiles_select_org_members" ON profiles FOR SELECT
  USING (
    id IN (
      SELECT user_id FROM organization_members
      WHERE organization_id = ANY(get_accessible_organization_ids())
    )
  );

-- =============================================================
-- ORGANIZATIONS
-- =============================================================
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizations_select" ON organizations;
CREATE POLICY "organizations_select" ON organizations FOR SELECT
  USING (id = ANY(get_accessible_organization_ids()));

DROP POLICY IF EXISTS "organizations_insert" ON organizations;
CREATE POLICY "organizations_insert" ON organizations FOR INSERT
  WITH CHECK (true); -- Any authenticated user can create an org

DROP POLICY IF EXISTS "organizations_update" ON organizations;
CREATE POLICY "organizations_update" ON organizations FOR UPDATE
  USING (id = ANY(get_user_organization_ids()));

-- =============================================================
-- ORGANIZATION MEMBERS
-- =============================================================
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "org_members_select" ON organization_members;
CREATE POLICY "org_members_select" ON organization_members FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

DROP POLICY IF EXISTS "org_members_insert" ON organization_members;
CREATE POLICY "org_members_insert" ON organization_members FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()) OR user_id = auth.uid());

DROP POLICY IF EXISTS "org_members_delete" ON organization_members;
CREATE POLICY "org_members_delete" ON organization_members FOR DELETE
  USING (organization_id = ANY(get_user_organization_ids()));

-- =============================================================
-- INVITATIONS
-- =============================================================
ALTER TABLE invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invitations_select" ON invitations;
CREATE POLICY "invitations_select" ON invitations FOR SELECT
  USING (
    organization_id = ANY(get_user_organization_ids())
    OR invited_email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

DROP POLICY IF EXISTS "invitations_insert" ON invitations;
CREATE POLICY "invitations_insert" ON invitations FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "invitations_update" ON invitations;
CREATE POLICY "invitations_update" ON invitations FOR UPDATE
  USING (
    organization_id = ANY(get_user_organization_ids())
    OR invited_email = (SELECT email FROM profiles WHERE id = auth.uid())
  );

-- =============================================================
-- ACCOUNTANT CLIENTS
-- =============================================================
ALTER TABLE accountant_clients ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "acc_clients_select" ON accountant_clients;
CREATE POLICY "acc_clients_select" ON accountant_clients FOR SELECT
  USING (
    accountant_id = auth.uid()
    OR organization_id = ANY(get_user_organization_ids())
  );

DROP POLICY IF EXISTS "acc_clients_insert" ON accountant_clients;
CREATE POLICY "acc_clients_insert" ON accountant_clients FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "acc_clients_update" ON accountant_clients;
CREATE POLICY "acc_clients_update" ON accountant_clients FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));

-- =============================================================
-- CHART OF ACCOUNTS
-- =============================================================
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- Everyone can see system defaults (organization_id IS NULL)
DROP POLICY IF EXISTS "coa_select_system" ON chart_of_accounts;
CREATE POLICY "coa_select_system" ON chart_of_accounts FOR SELECT
  USING (organization_id IS NULL);

-- Members and accountants can see org-specific accounts
DROP POLICY IF EXISTS "coa_select_org" ON chart_of_accounts;
CREATE POLICY "coa_select_org" ON chart_of_accounts FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

DROP POLICY IF EXISTS "coa_insert" ON chart_of_accounts;
CREATE POLICY "coa_insert" ON chart_of_accounts FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "coa_update" ON chart_of_accounts;
CREATE POLICY "coa_update" ON chart_of_accounts FOR UPDATE
  USING (
    organization_id = ANY(get_user_organization_ids())
    AND is_system = FALSE
  );

-- =============================================================
-- INVOICES
-- =============================================================
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoices_select" ON invoices;
CREATE POLICY "invoices_select" ON invoices FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

DROP POLICY IF EXISTS "invoices_insert" ON invoices;
CREATE POLICY "invoices_insert" ON invoices FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "invoices_update" ON invoices;
CREATE POLICY "invoices_update" ON invoices FOR UPDATE
  USING (
    organization_id = ANY(get_user_organization_ids())
    AND status NOT IN ('closed', 'cancelled')
  );

-- =============================================================
-- INVOICE ITEMS
-- =============================================================
ALTER TABLE invoice_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "invoice_items_select" ON invoice_items;
CREATE POLICY "invoice_items_select" ON invoice_items FOR SELECT
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE organization_id = ANY(get_accessible_organization_ids())
    )
  );

DROP POLICY IF EXISTS "invoice_items_insert" ON invoice_items;
CREATE POLICY "invoice_items_insert" ON invoice_items FOR INSERT
  WITH CHECK (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE organization_id = ANY(get_user_organization_ids())
    )
  );

DROP POLICY IF EXISTS "invoice_items_update" ON invoice_items;
CREATE POLICY "invoice_items_update" ON invoice_items FOR UPDATE
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE organization_id = ANY(get_user_organization_ids())
      AND status NOT IN ('closed', 'cancelled')
    )
  );

DROP POLICY IF EXISTS "invoice_items_delete" ON invoice_items;
CREATE POLICY "invoice_items_delete" ON invoice_items FOR DELETE
  USING (
    invoice_id IN (
      SELECT id FROM invoices
      WHERE organization_id = ANY(get_user_organization_ids())
      AND status NOT IN ('closed', 'cancelled')
    )
  );

-- =============================================================
-- DOCUMENTS
-- =============================================================
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "documents_select" ON documents;
CREATE POLICY "documents_select" ON documents FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

DROP POLICY IF EXISTS "documents_insert" ON documents;
CREATE POLICY "documents_insert" ON documents FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "documents_update" ON documents;
CREATE POLICY "documents_update" ON documents FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));

-- =============================================================
-- LEDGER ENTRIES
-- =============================================================
ALTER TABLE ledger_entries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ledger_select" ON ledger_entries;
CREATE POLICY "ledger_select" ON ledger_entries FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

DROP POLICY IF EXISTS "ledger_insert" ON ledger_entries;
CREATE POLICY "ledger_insert" ON ledger_entries FOR INSERT
  WITH CHECK (organization_id = ANY(get_accessible_organization_ids()));

DROP POLICY IF EXISTS "ledger_update" ON ledger_entries;
CREATE POLICY "ledger_update" ON ledger_entries FOR UPDATE
  USING (
    organization_id = ANY(get_accessible_organization_ids())
    AND status = 'draft'
  );

-- =============================================================
-- AUDIT LOGS — INSERT + SELECT only, NEVER update or delete
-- =============================================================
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "audit_logs_insert" ON audit_logs;
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
  WITH CHECK (true);

DROP POLICY IF EXISTS "audit_logs_select" ON audit_logs;
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

-- =============================================================
-- SUBSCRIPTIONS
-- =============================================================
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select" ON subscriptions;
CREATE POLICY "subscriptions_select" ON subscriptions FOR SELECT
  USING (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "subscriptions_update" ON subscriptions;
CREATE POLICY "subscriptions_update" ON subscriptions FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));
