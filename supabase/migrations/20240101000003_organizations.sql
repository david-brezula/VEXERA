CREATE TABLE IF NOT EXISTS organizations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  ico                 TEXT NOT NULL,
  dic                 TEXT,
  ic_dph              TEXT,
  address_street      TEXT,
  address_city        TEXT,
  address_zip         TEXT,
  address_country     TEXT NOT NULL DEFAULT 'SK',
  phone               TEXT,
  email               TEXT,
  website             TEXT,
  bank_iban           TEXT,
  bank_swift          TEXT,
  logo_url            TEXT,
  logo_path           TEXT,
  subscription_plan   TEXT NOT NULL DEFAULT 'free'
                        CHECK (subscription_plan IN ('free','freelancer','small_business','medium_business','accounting_firm')),
  storage_used_bytes  BIGINT NOT NULL DEFAULT 0,
  peppol_endpoint_id  TEXT,
  peppol_scheme       TEXT DEFAULT 'iso6523-actorid-upis',
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_organizations_ico ON organizations(ico);
DROP TRIGGER IF EXISTS organizations_updated_at ON organizations;
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
