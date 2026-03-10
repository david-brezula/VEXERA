-- =============================================================
-- Organization Types & Profile Tables
-- =============================================================

-- 1. Add organization_type column to organizations
ALTER TABLE organizations
  ADD COLUMN organization_type TEXT NOT NULL DEFAULT 'freelancer'
    CHECK (organization_type IN ('freelancer', 'company', 'accounting_firm'));

-- Index on organization_type for filtering
CREATE INDEX idx_organizations_organization_type ON organizations(organization_type);

-- =============================================================
-- 2. Freelancer Profiles
-- =============================================================
CREATE TABLE freelancer_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE
                    REFERENCES organizations(id) ON DELETE CASCADE,
  ico             TEXT,
  tax_regime      TEXT NOT NULL DEFAULT 'pausalne_vydavky'
                    CHECK (tax_regime IN ('pausalne_vydavky', 'naklady')),
  registered_dph  BOOLEAN DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 3. Company Profiles
-- =============================================================
CREATE TABLE company_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE
                    REFERENCES organizations(id) ON DELETE CASCADE,
  ico             TEXT,
  ic_dph          TEXT,
  dph_status      TEXT NOT NULL DEFAULT 'neplatca'
                    CHECK (dph_status IN ('platca', 'neplatca')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 4. Accounting Firm Profiles
-- =============================================================
CREATE TABLE accounting_firm_profiles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL UNIQUE
                    REFERENCES organizations(id) ON DELETE CASCADE,
  referral_code   TEXT NOT NULL UNIQUE
                    DEFAULT substr(md5(gen_random_uuid()::text), 1, 10),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================
-- 5. RLS Policies
-- =============================================================

-- Freelancer Profiles RLS
ALTER TABLE freelancer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "freelancer_profiles_select" ON freelancer_profiles;
CREATE POLICY "freelancer_profiles_select" ON freelancer_profiles FOR SELECT
  USING (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "freelancer_profiles_insert" ON freelancer_profiles;
CREATE POLICY "freelancer_profiles_insert" ON freelancer_profiles FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "freelancer_profiles_update" ON freelancer_profiles;
CREATE POLICY "freelancer_profiles_update" ON freelancer_profiles FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));

-- Company Profiles RLS
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_profiles_select" ON company_profiles;
CREATE POLICY "company_profiles_select" ON company_profiles FOR SELECT
  USING (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "company_profiles_insert" ON company_profiles;
CREATE POLICY "company_profiles_insert" ON company_profiles FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "company_profiles_update" ON company_profiles;
CREATE POLICY "company_profiles_update" ON company_profiles FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));

-- Accounting Firm Profiles RLS
ALTER TABLE accounting_firm_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounting_firm_profiles_select" ON accounting_firm_profiles;
CREATE POLICY "accounting_firm_profiles_select" ON accounting_firm_profiles FOR SELECT
  USING (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "accounting_firm_profiles_insert" ON accounting_firm_profiles;
CREATE POLICY "accounting_firm_profiles_insert" ON accounting_firm_profiles FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "accounting_firm_profiles_update" ON accounting_firm_profiles;
CREATE POLICY "accounting_firm_profiles_update" ON accounting_firm_profiles FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));
