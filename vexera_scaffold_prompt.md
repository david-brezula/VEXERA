# Vexera – AI Scaffold & Build Prompt
> **Instructions for AI coding agents (Cursor / Claude Code)**
> Read this entire document before writing a single line of code.
> Work phase by phase. Never start a phase before the previous one is committed and verified.

---

## 1. Project Context

You are building **Vexera** — a multi-tenant SaaS application for invoice management, accounting document storage, and ledger management, targeting the **Slovak and EU market**.

Primary users:
- **Business owners / Companies** – create & manage invoices, upload documents, invite accountants
- **Accountants** – access multiple client organizations, close invoices, assign MD/D ledger accounts, manage the general ledger

The app must be **compliance-ready** for:
- Slovak Zákon o účtovníctve (Act on Accounting)
- Slovak DPH Zákon (VAT Act)
- GDPR
- **Peppol e-invoicing** (mandatory B2B e-invoicing in Slovakia from January 2027 — architecture must support this from day one as an extensible layer)

---

## 2. Repository Architecture

Use a **pnpm monorepo with Turborepo**. This is non-negotiable. Reason: shared types between Next.js and Supabase Edge Functions, future mobile app, and Peppol XML utilities.

### Directory structure

```
vexera/
├── apps/
│   └── web/                        # Next.js 15 App Router application
├── packages/
│   ├── types/                      # Auto-generated Supabase DB types + shared domain types
│   ├── utils/                      # Shared business logic: VAT, invoice calc, Peppol, formatting
│   └── config/                     # Shared ESLint, TypeScript, Tailwind configs
├── supabase/
│   ├── migrations/                 # Numbered SQL migration files
│   ├── functions/                  # Supabase Edge Functions (Deno)
│   └── seed.sql                    # Dev seed data
├── .env.example                    # Root env template
├── turbo.json
├── pnpm-workspace.yaml
└── package.json
```

### Root `pnpm-workspace.yaml`
```yaml
packages:
  - "apps/*"
  - "packages/*"
```

### Root `turbo.json`
```json
{
  "$schema": "https://turborepo.org/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": [".next/**", "dist/**"] },
    "dev": { "cache": false, "persistent": true },
    "lint": { "dependsOn": ["^build"] },
    "type-check": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] },
    "db:generate-types": { "cache": false }
  }
}
```

---

## 3. Tech Stack

### Frontend (`apps/web`)
| Layer | Package | Version |
|---|---|---|
| Framework | `next` | 15.x (App Router) |
| Auth | `@supabase/ssr` + `@supabase/auth-helpers-nextjs` | latest |
| UI | `shadcn/ui` | latest |
| Styling | `tailwindcss` | v4.x |
| Data fetching | `@tanstack/react-query` | v5 |
| Forms | `react-hook-form` + `zod` | latest |
| Tables | `@tanstack/react-table` | v8 |
| Date handling | `date-fns` | v3 |
| Notifications | `sonner` | latest |
| Icons | `lucide-react` | latest |

### Backend / Database
| Service | Role |
|---|---|
| Supabase | PostgreSQL DB, Auth, Storage, Edge Functions |
| Row Level Security | All tables — no exceptions |
| Supabase Edge Functions | Server-side logic (invoice closing, audit logging, invite handling) |

### Storage
- **AWS S3** compatible (use `@aws-sdk/client-s3` with presigned URLs)
- All file operations go through Edge Functions or Next.js API routes — **never expose S3 credentials to the client**

### External Services (prepare integration scaffold, implement in later phases)
| Service | Phase |
|---|---|
| Stripe | Post-MVP Phase 4 |
| Google OAuth / Drive | Post-MVP Phase 1 |
| OCR provider (TBD) | Post-MVP Phase 2 |
| Peppol Access Point | Post-MVP Phase 3+ |

---

## 4. Environment Variables

Create `.env.example` at root AND at `apps/web/.env.example`:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AWS S3
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET_NAME=

# App
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_NAME=Vexera

# Stripe (scaffold only, leave empty)
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
```

---

## 5. Database Schema

Apply all migrations in order. Every migration file must be idempotent (`IF NOT EXISTS`).
Use UUID primary keys everywhere. Use `TIMESTAMPTZ` for all timestamps.

### Migration 001 — Extensions & Helpers
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Auto-update updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
```

### Migration 002 — Profiles
```sql
CREATE TABLE IF NOT EXISTS profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       TEXT NOT NULL,
  full_name   TEXT,
  avatar_url  TEXT,
  phone       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

### Migration 003 — Organizations
```sql
-- Slovak business identifiers:
-- IČO (Identifikačné číslo organizácie) - 8 digit company ID
-- DIČ (Daňové identifikačné číslo) - tax ID
-- IČ DPH (Identifikačné číslo pre DPH) - VAT ID, format: SK + 10 digits

CREATE TABLE IF NOT EXISTS organizations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  ico                 TEXT NOT NULL,               -- IČO: 8-digit company registration number
  dic                 TEXT,                        -- DIČ: tax identification number
  ic_dph              TEXT,                        -- IČ DPH: VAT ID (format: SK + 10 digits)
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
  -- Subscription
  subscription_plan   TEXT NOT NULL DEFAULT 'free'
                        CHECK (subscription_plan IN ('free','freelancer','small_business','medium_business','accounting_firm')),
  -- Storage tracking
  storage_used_bytes  BIGINT NOT NULL DEFAULT 0,
  -- Peppol (future phase)
  peppol_endpoint_id  TEXT,
  peppol_scheme       TEXT DEFAULT 'iso6523-actorid-upis',
  -- Soft delete
  deleted_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_organizations_ico ON organizations(ico);
CREATE TRIGGER organizations_updated_at
  BEFORE UPDATE ON organizations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Migration 004 — Organization Members
```sql
-- Roles within an organization (business side)
CREATE TABLE IF NOT EXISTS organization_members (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id          UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role             TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, user_id)
);

CREATE INDEX idx_org_members_user ON organization_members(user_id);
CREATE INDEX idx_org_members_org  ON organization_members(organization_id);
```

### Migration 005 — Invitations
```sql
CREATE TABLE IF NOT EXISTS invitations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invited_by       UUID NOT NULL REFERENCES profiles(id),
  invited_email    TEXT NOT NULL,
  role             TEXT NOT NULL CHECK (role IN ('accountant', 'admin', 'member')),
  token            TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status           TEXT NOT NULL DEFAULT 'pending'
                     CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invitations_token ON invitations(token);
CREATE INDEX idx_invitations_email ON invitations(invited_email);
```

### Migration 006 — Accountant–Client Relationships
```sql
-- An accountant (profile) can be linked to multiple organizations
CREATE TABLE IF NOT EXISTS accountant_clients (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  accountant_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invitation_id    UUID REFERENCES invitations(id),
  status           TEXT NOT NULL DEFAULT 'active'
                     CHECK (status IN ('pending', 'active', 'revoked')),
  permissions      JSONB NOT NULL DEFAULT '{
    "view_invoices": true,
    "close_invoices": true,
    "manage_ledger": true,
    "view_documents": true,
    "upload_documents": false
  }'::jsonb,
  accepted_at      TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (accountant_id, organization_id)
);

CREATE INDEX idx_acc_clients_accountant ON accountant_clients(accountant_id);
CREATE INDEX idx_acc_clients_org        ON accountant_clients(organization_id);
```

### Migration 007 — Chart of Accounts
```sql
-- System-level defaults (organization_id IS NULL) + per-org customizations
CREATE TABLE IF NOT EXISTS chart_of_accounts (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE CASCADE,
  account_number   TEXT NOT NULL,
  account_name     TEXT NOT NULL,
  account_class    TEXT NOT NULL,    -- '1'-'9' per Slovak účtovná osnova
  account_type     TEXT NOT NULL
                     CHECK (account_type IN ('asset','liability','equity','revenue','expense','off_balance')),
  parent_id        UUID REFERENCES chart_of_accounts(id),
  is_active        BOOLEAN NOT NULL DEFAULT TRUE,
  is_system        BOOLEAN NOT NULL DEFAULT FALSE,  -- system default, read-only
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_coa_org_number ON chart_of_accounts(organization_id, account_number)
  WHERE organization_id IS NOT NULL;
CREATE INDEX idx_coa_number ON chart_of_accounts(account_number);
```

### Migration 008 — Invoices
```sql
CREATE TABLE IF NOT EXISTS invoices (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id      UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,

  -- Invoice identification
  invoice_number       TEXT NOT NULL,
  invoice_type         TEXT NOT NULL CHECK (invoice_type IN ('issued', 'received')),
  status               TEXT NOT NULL DEFAULT 'draft'
                         CHECK (status IN ('draft','sent','paid','overdue','cancelled','closed')),

  -- Supplier (dodávateľ)
  supplier_name        TEXT NOT NULL,
  supplier_ico         TEXT,
  supplier_dic         TEXT,
  supplier_ic_dph      TEXT,
  supplier_address     TEXT,
  supplier_iban        TEXT,

  -- Customer (odberateľ)
  customer_name        TEXT NOT NULL,
  customer_ico         TEXT,
  customer_dic         TEXT,
  customer_ic_dph      TEXT,
  customer_address     TEXT,

  -- Dates
  issue_date           DATE NOT NULL,
  delivery_date        DATE,
  due_date             DATE NOT NULL,
  paid_at              TIMESTAMPTZ,

  -- Amounts (always store in smallest unit logic; use DECIMAL for accounting)
  subtotal             DECIMAL(15,2) NOT NULL DEFAULT 0,
  vat_amount           DECIMAL(15,2) NOT NULL DEFAULT 0,
  total                DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency             TEXT NOT NULL DEFAULT 'EUR',

  -- Payment info
  payment_method       TEXT CHECK (payment_method IN ('bank_transfer','cash','card','other')),
  bank_iban            TEXT,
  variable_symbol      TEXT,
  constant_symbol      TEXT,
  specific_symbol      TEXT,

  -- Notes
  notes                TEXT,
  internal_notes       TEXT,

  -- File storage
  file_path            TEXT,    -- S3 key
  file_url             TEXT,    -- presigned or public URL (do NOT store long-term)

  -- Peppol (scaffold for Phase Post-MVP)
  peppol_id            TEXT,
  peppol_status        TEXT CHECK (peppol_status IN ('not_sent','pending','delivered','failed')),
  peppol_sent_at       TIMESTAMPTZ,

  -- Accounting closure
  closed_by            UUID REFERENCES profiles(id),
  closed_at            TIMESTAMPTZ,

  -- Audit
  created_by           UUID REFERENCES profiles(id),
  updated_by           UUID REFERENCES profiles(id),
  deleted_at           TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (organization_id, invoice_number, invoice_type)
);

CREATE INDEX idx_invoices_org        ON invoices(organization_id);
CREATE INDEX idx_invoices_status     ON invoices(status);
CREATE INDEX idx_invoices_due_date   ON invoices(due_date);
CREATE INDEX idx_invoices_type       ON invoices(invoice_type);

CREATE TRIGGER invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Migration 009 — Invoice Items
```sql
CREATE TABLE IF NOT EXISTS invoice_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id      UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description     TEXT NOT NULL,
  quantity        DECIMAL(10,4) NOT NULL DEFAULT 1,
  unit            TEXT,
  unit_price      DECIMAL(15,4) NOT NULL,
  vat_rate        DECIMAL(5,2) NOT NULL DEFAULT 20.00,  -- Slovak VAT: 20%, 10%, 5%, 0%
  vat_amount      DECIMAL(15,2) NOT NULL DEFAULT 0,
  total           DECIMAL(15,2) NOT NULL,
  sort_order      INTEGER NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoice_items_invoice ON invoice_items(invoice_id);
```

### Migration 010 — Documents
```sql
CREATE TABLE IF NOT EXISTS documents (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id       UUID REFERENCES invoices(id) ON DELETE SET NULL,

  -- File metadata
  name             TEXT NOT NULL,
  file_path        TEXT NOT NULL,    -- S3 key
  file_size_bytes  BIGINT,
  mime_type        TEXT,
  checksum_sha256  TEXT,             -- for integrity verification

  -- Classification
  document_type    TEXT CHECK (document_type IN (
    'invoice_issued','invoice_received','receipt',
    'contract','bank_statement','tax_document','other'
  )),

  -- Retention (Slovak law: min 5 years, VAT docs: 10 years)
  retention_until  DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '10 years'),
  is_archived      BOOLEAN NOT NULL DEFAULT FALSE,

  -- OCR (Post-MVP Phase 2 scaffold)
  ocr_status       TEXT NOT NULL DEFAULT 'not_queued'
                     CHECK (ocr_status IN ('not_queued','queued','processing','done','failed')),
  ocr_data         JSONB,
  ocr_processed_at TIMESTAMPTZ,

  -- Audit
  uploaded_by      UUID REFERENCES profiles(id),
  deleted_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_documents_org     ON documents(organization_id);
CREATE INDEX idx_documents_invoice ON documents(invoice_id);
CREATE INDEX idx_documents_type    ON documents(document_type);

CREATE TRIGGER documents_updated_at
  BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Migration 011 — Ledger Entries (Hlavná kniha)
```sql
CREATE TABLE IF NOT EXISTS ledger_entries (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  invoice_id            UUID REFERENCES invoices(id) ON DELETE SET NULL,
  document_id           UUID REFERENCES documents(id) ON DELETE SET NULL,

  -- Entry metadata
  entry_date            DATE NOT NULL,
  period_year           SMALLINT NOT NULL GENERATED ALWAYS AS (EXTRACT(YEAR FROM entry_date)::SMALLINT) STORED,
  period_month          SMALLINT NOT NULL GENERATED ALWAYS AS (EXTRACT(MONTH FROM entry_date)::SMALLINT) STORED,
  description           TEXT NOT NULL,
  reference_number      TEXT,

  -- Double-entry bookkeeping (MD = Má dať / Debit; D = Dal / Credit)
  debit_account_id      UUID REFERENCES chart_of_accounts(id),
  credit_account_id     UUID REFERENCES chart_of_accounts(id),
  debit_account_number  TEXT NOT NULL,   -- denormalized for query performance + audit safety
  credit_account_number TEXT NOT NULL,
  amount                DECIMAL(15,2) NOT NULL CHECK (amount > 0),
  currency              TEXT NOT NULL DEFAULT 'EUR',

  -- Status
  status                TEXT NOT NULL DEFAULT 'draft'
                          CHECK (status IN ('draft','posted','reversed')),
  is_closing_entry      BOOLEAN NOT NULL DEFAULT FALSE,
  reversed_by           UUID REFERENCES ledger_entries(id),

  -- Audit
  created_by            UUID REFERENCES profiles(id),
  posted_by             UUID REFERENCES profiles(id),
  posted_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_org        ON ledger_entries(organization_id);
CREATE INDEX idx_ledger_date       ON ledger_entries(entry_date);
CREATE INDEX idx_ledger_period     ON ledger_entries(period_year, period_month);
CREATE INDEX idx_ledger_debit_acc  ON ledger_entries(debit_account_number);
CREATE INDEX idx_ledger_credit_acc ON ledger_entries(credit_account_number);

CREATE TRIGGER ledger_entries_updated_at
  BEFORE UPDATE ON ledger_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

### Migration 012 — Audit Logs
```sql
-- Immutable audit log — NO updates, NO deletes via RLS
CREATE TABLE IF NOT EXISTS audit_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID REFERENCES organizations(id) ON DELETE SET NULL,
  user_id          UUID REFERENCES profiles(id) ON DELETE SET NULL,
  action           TEXT NOT NULL,        -- INVOICE_CREATED, INVOICE_CLOSED, etc.
  entity_type      TEXT NOT NULL,        -- invoice, document, ledger_entry, profile, etc.
  entity_id        UUID,
  old_data         JSONB,
  new_data         JSONB,
  metadata         JSONB,                -- ip_address, user_agent, etc.
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_org    ON audit_logs(organization_id);
CREATE INDEX idx_audit_user   ON audit_logs(user_id);
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_date   ON audit_logs(created_at);
```

### Migration 013 — Subscriptions (Stripe scaffold)
```sql
CREATE TABLE IF NOT EXISTS subscriptions (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id          UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE UNIQUE,
  stripe_customer_id       TEXT UNIQUE,
  stripe_subscription_id   TEXT UNIQUE,
  plan                     TEXT NOT NULL DEFAULT 'free'
                             CHECK (plan IN ('free','freelancer','small_business','medium_business','accounting_firm')),
  status                   TEXT NOT NULL DEFAULT 'active'
                             CHECK (status IN ('active','past_due','cancelled','trialing','incomplete')),
  current_period_start     TIMESTAMPTZ,
  current_period_end       TIMESTAMPTZ,
  cancel_at_period_end     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
```

---

## 6. Row Level Security (RLS) Policies

Enable RLS on ALL tables. Use helper functions for clean policy definitions.

### Helper Functions
```sql
-- Returns the organization IDs the current user is a member of
CREATE OR REPLACE FUNCTION get_user_organization_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT organization_id FROM organization_members
    WHERE user_id = auth.uid()
    AND organization_id IN (
      SELECT id FROM organizations WHERE deleted_at IS NULL
    )
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns organization IDs where the user is an active accountant
CREATE OR REPLACE FUNCTION get_accountant_organization_ids()
RETURNS UUID[] AS $$
  SELECT ARRAY(
    SELECT organization_id FROM accountant_clients
    WHERE accountant_id = auth.uid() AND status = 'active'
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Returns all organization IDs the current user can access
CREATE OR REPLACE FUNCTION get_accessible_organization_ids()
RETURNS UUID[] AS $$
  SELECT array_cat(
    get_user_organization_ids(),
    get_accountant_organization_ids()
  )
$$ LANGUAGE sql SECURITY DEFINER STABLE;
```

### RLS Policy Pattern (apply to each table)
```sql
-- Example for invoices (apply same pattern to documents, ledger_entries, etc.)
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

-- Members can view their org invoices
CREATE POLICY "invoices_select" ON invoices FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));

-- Only org members (not accountants) can create invoices
CREATE POLICY "invoices_insert" ON invoices FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

-- Org members can update non-closed invoices
CREATE POLICY "invoices_update" ON invoices FOR UPDATE
  USING (
    organization_id = ANY(get_user_organization_ids())
    AND status NOT IN ('closed', 'cancelled')
  );

-- Audit logs: insert only, no select/update/delete for non-service roles
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "audit_logs_insert" ON audit_logs FOR INSERT
  WITH CHECK (true);
CREATE POLICY "audit_logs_select" ON audit_logs FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));
-- No UPDATE or DELETE policies on audit_logs — ever.
```

---

## 7. Next.js App Structure (`apps/web`)

```
apps/web/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/
│   │   │   ├── register/
│   │   │   └── invite/[token]/
│   │   ├── (dashboard)/
│   │   │   ├── layout.tsx              # Authenticated layout with sidebar
│   │   │   ├── page.tsx                # Dashboard home
│   │   │   ├── invoices/
│   │   │   │   ├── page.tsx            # Invoice list
│   │   │   │   ├── new/page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── documents/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── ledger/
│   │   │   │   ├── page.tsx
│   │   │   │   └── entries/[id]/page.tsx
│   │   │   ├── settings/
│   │   │   │   ├── page.tsx            # Org settings (IČO, DIČ, etc.)
│   │   │   │   ├── members/page.tsx
│   │   │   │   └── billing/page.tsx
│   │   │   └── clients/               # Accountant view: list of client orgs
│   │   │       └── [orgId]/           # Accountant scoped view
│   │   ├── api/
│   │   │   ├── auth/callback/route.ts  # Supabase OAuth callback
│   │   │   ├── storage/
│   │   │   │   ├── upload/route.ts    # Presigned upload URL
│   │   │   │   └── download/route.ts  # Presigned download URL
│   │   │   └── webhooks/
│   │   │       └── stripe/route.ts    # Stripe webhook (scaffold)
│   │   ├── layout.tsx
│   │   └── globals.css
│   ├── components/
│   │   ├── ui/                        # ShadCN components (auto-generated)
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx
│   │   │   ├── Header.tsx
│   │   │   └── OrgSwitcher.tsx        # Switch between organizations
│   │   ├── invoices/
│   │   │   ├── InvoiceTable.tsx
│   │   │   ├── InvoiceForm.tsx
│   │   │   ├── InvoiceStatusBadge.tsx
│   │   │   └── InvoicePDFPreview.tsx
│   │   ├── documents/
│   │   │   ├── DocumentUploader.tsx
│   │   │   └── DocumentList.tsx
│   │   ├── ledger/
│   │   │   ├── LedgerTable.tsx
│   │   │   └── EntryForm.tsx
│   │   └── shared/
│   │       ├── DataTable.tsx          # Generic TanStack Table wrapper
│   │       ├── FileUpload.tsx
│   │       ├── ConfirmDialog.tsx
│   │       └── AuditTrail.tsx
│   ├── lib/
│   │   ├── supabase/
│   │   │   ├── client.ts              # Browser client
│   │   │   ├── server.ts              # Server client (cookies)
│   │   │   └── middleware.ts          # Session refresh
│   │   ├── s3/
│   │   │   └── client.ts              # AWS S3 client wrapper
│   │   ├── validations/
│   │   │   ├── invoice.schema.ts      # Zod schemas
│   │   │   ├── organization.schema.ts
│   │   │   └── document.schema.ts
│   │   └── constants/
│   │       ├── vat-rates.ts           # Slovak VAT rates: 20%, 10%, 5%, 0%
│   │       └── account-classes.ts
│   ├── hooks/
│   │   ├── use-organization.ts        # Active org context
│   │   ├── use-invoices.ts
│   │   ├── use-documents.ts
│   │   └── use-ledger.ts
│   ├── providers/
│   │   ├── QueryProvider.tsx          # TanStack Query
│   │   ├── OrganizationProvider.tsx   # Active org context
│   │   └── SupabaseProvider.tsx
│   ├── types/
│   │   └── index.ts                   # Re-export from @vexera/types
│   └── middleware.ts                  # Route protection
├── public/
├── next.config.ts
├── tailwind.config.ts
└── package.json
```

---

## 8. Middleware & Auth Guard

`apps/web/src/middleware.ts`:
```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login', '/register', '/invite']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { /* cookie helpers */ } }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const isPublicRoute = PUBLIC_ROUTES.some(r => request.nextUrl.pathname.startsWith(r))

  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/login', request.url))
  }
  if (user && request.nextUrl.pathname === '/login') {
    return NextResponse.redirect(new URL('/', request.url))
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)'],
}
```

---

## 9. Organization Context Pattern

Every data query MUST be scoped by `organizationId`. Use a React context + cookie pattern:

- Store `active_organization_id` in a cookie (httpOnly preferred for SSR pages)
- `OrganizationProvider` reads this and exposes `activeOrg`, `switchOrg(id)`, `userOrgs[]`
- All Supabase queries receive `organizationId` as a parameter — **never use global state for multi-tenant data**
- Accountants get an additional `clientOrgs[]` array from `accountant_clients`

---

## 10. S3 File Upload Pattern

**Never** expose S3 credentials to the browser. The flow is:
1. Client calls `POST /api/storage/upload` with `{ fileName, mimeType, organizationId }`
2. API route validates session + org membership, generates a presigned PUT URL (15 min expiry)
3. API route returns `{ uploadUrl, filePath }` to client
4. Client uploads directly to S3 using the presigned URL
5. On success, client saves `filePath` to the DB record (invoice, document)
6. For downloads: `GET /api/storage/download?path=...` generates presigned GET URL (5 min expiry)

S3 key structure: `{organizationId}/{year}/{month}/{uuid}/{filename}`

---

## 11. Edge Functions

Create the following Supabase Edge Functions in `supabase/functions/`:

| Function | Trigger | Purpose |
|---|---|---|
| `close-invoice` | HTTP POST | Validates, closes invoice, creates ledger entry, writes audit log |
| `handle-invitation` | HTTP POST | Validates token, creates `accountant_clients` or `organization_members` record |
| `calculate-storage` | DB trigger / cron | Recalculates `organizations.storage_used_bytes` |
| `send-overdue-alerts` | Scheduled (daily) | Marks invoices as `overdue`, notifies owner |
| `write-audit-log` | Called internally | Centralized audit log writer (prevents client-side bypass) |

All Edge Functions must:
- Verify `Authorization: Bearer <JWT>` header using `supabase.auth.getUser()`
- Return standard `{ data, error }` response shape
- Write to `audit_logs` on every state-changing operation

---

## 12. Coding Standards

These rules are MANDATORY throughout the entire codebase:

### TypeScript
- Strict mode enabled everywhere (`"strict": true`)
- No `any` types — use `unknown` and narrow
- All DB types imported from `@vexera/types` (auto-generated from Supabase schema)
- Use Zod for ALL runtime validation (API inputs, form data, env vars)

### React / Next.js
- Use **Server Components by default**; add `"use client"` only when needed (interactivity, hooks)
- Data fetching in Server Components via Supabase server client
- Client-side mutations via TanStack Query `useMutation` + Supabase client
- Use `React.Suspense` + loading skeletons for all async boundaries
- No `useEffect` for data fetching — use TanStack Query

### Error Handling
- Every Server Action and API route returns `{ data: T | null, error: string | null }`
- Use `toast.error()` (Sonner) for user-facing errors
- Log server errors with `console.error` (replace with proper logger in production)

### Security
- All monetary values: `DECIMAL(15,2)` in DB, `string` in JSON transport (never `float`)
- All file paths validated server-side before S3 operations
- Rate limiting on auth routes (use Supabase's built-in or edge function middleware)
- Input sanitization on all text fields stored to DB
- `SECURITY DEFINER` functions reviewed carefully — document every usage

### Naming Conventions
- Files: `kebab-case.tsx`
- Components: `PascalCase`
- Hooks: `use-camel-case.ts`
- DB tables: `snake_case`
- TypeScript types: `PascalCase`
- Zod schemas: `camelCaseSchema`

---

## 13. Implementation Phases

Work through phases sequentially. Each phase ends with a working, deployable state.
Do not scaffold future phases — only create placeholder files with `// TODO: Phase N` comments.

---

### PHASE 0 — Infrastructure & Scaffold
**Goal:** A deployable, authenticated skeleton with DB and RLS in place.

Tasks:
1. Initialize pnpm monorepo with Turborepo (structure from Section 2)
2. Bootstrap `apps/web` with Next.js 15, TypeScript strict, Tailwind v4, ShadCN
3. Install and configure all dependencies (Section 3)
4. Set up `packages/types` with Supabase type generation script
5. Set up `packages/utils` with empty exports + VAT rate constants
6. Set up `packages/config` with shared TS + ESLint configs
7. Apply ALL database migrations (Sections 5) in order
8. Configure RLS helper functions and base policies (Section 6)
9. Implement Supabase Auth (email/password + magic link)
10. Implement middleware route protection (Section 8)
11. Create `OrganizationProvider` with org switcher logic
12. Build authenticated layout: Sidebar + Header + OrgSwitcher
13. Create org creation flow (onboarding: name, IČO, DIČ, IČ DPH)
14. S3 client setup + upload/download API routes (Section 10)
15. Set up `.env.example` and environment validation with Zod
16. Seed `chart_of_accounts` with Slovak default accounts (at minimum classes 1–6)
17. Write `supabase/functions/write-audit-log` Edge Function
18. Verify: user can register → create org → see empty dashboard

**Deliverable:** Running app at `localhost:3000`, user can authenticate, create an organization, see empty dashboard. All tables exist with RLS. Audit logging functional.

---

### PHASE 1 — Invoices & Documents
**Goal:** Full invoice lifecycle + document storage.

Tasks:
1. Invoice list page with TanStack Table (filterable by status, type, date range)
2. Invoice create/edit form with full Slovak fields (IČO, DIČ, IČ DPH, variable/constant/specific symbol)
3. Invoice items: add/remove/reorder line items, auto-calculate VAT (20%, 10%, 5%, 0% rates)
4. Invoice status transitions: draft → sent → paid (manual for now)
5. Document upload: drag-and-drop, file type validation, progress indicator
6. Document list with preview (PDF inline viewer)
7. Invoice ↔ Document linking
8. `InvoiceStatusBadge` component with color coding
9. Overdue detection (due_date < today AND status not paid/cancelled/closed)
10. `supabase/functions/send-overdue-alerts` scaffold (cron, no email sending yet)
11. Audit log writes on all invoice mutations
12. Invoice PDF generation (use `@react-pdf/renderer` — basic template)
13. TanStack Query cache invalidation strategy (define query keys in `lib/query-keys.ts`)

**Deliverable:** Full invoice CRUD, document upload to S3, invoice-document linking, audit trail working.

---

### PHASE 2 — Accountants & Ledger
**Goal:** Accountant multi-org access + full general ledger.

Tasks:
1. Invitation flow: org owner sends email invite → accountant accepts via `/invite/[token]`
2. `accountant_clients` table population on invite acceptance
3. Accountant dashboard: list of client organizations with quick-switch
4. Scoped accountant view: can see invoices/documents, cannot edit org settings
5. Invoice closing flow (accountant only):
   - Select MD/D accounts from chart of accounts
   - Validate double-entry amounts balance
   - Status → `closed`, create `ledger_entry`, lock invoice for further edits
   - `supabase/functions/close-invoice` Edge Function
6. Ledger (Hlavná kniha) list page: filterable by period, account number, status
7. Ledger entry detail view with full audit trail
8. Chart of accounts management (org-specific overrides on top of system defaults)
9. Permission enforcement: accountants cannot create invoices, cannot delete documents
10. Member management page (org owner): view members, accountants, revoke access
11. `supabase/functions/handle-invitation` Edge Function
12. Audit log writes on all accountant actions and org member changes
13. Basic period reports: trial balance per month (aggregate debit/credit per account)

**Deliverable:** Full accountant workflow, multi-org access, invoice closing with double-entry, ledger management.

---

### POST-MVP PHASE 1 — Document Sync (Google Drive / Email)
*(Do not implement yet. Scaffold API routes with `501 Not Implemented`.)*

---

### POST-MVP PHASE 2 — OCR & Parsing
*(Do not implement yet. `documents.ocr_status` field is already in schema.)*

---

### POST-MVP PHASE 3 — AI Ledger Classification
*(Do not implement yet. MD/D suggestion logic will use ledger history as training data.)*

---

### POST-MVP PHASE 4 — Subscription & Billing
*(Do not implement yet. `subscriptions` table and Stripe webhook route are scaffolded.)*

---

### POST-MVP PHASE 5 — Peppol E-Invoicing
*(Architecture already prepared: `peppol_id`, `peppol_status`, `peppol_endpoint_id` fields in schema. Mandatory in Slovakia from January 2027. Implement as a separate Edge Function + Peppol Access Point integration.)*

---

## 14. Testing Strategy

- **Unit tests:** `packages/utils` — all calculation functions (VAT, invoice totals, IBAN validation)
- **Integration tests:** Supabase RLS policies (use `supabase test db`)
- **E2E (Post-MVP):** Playwright for critical flows (register, create invoice, close invoice)
- Test runner: **Vitest** for unit + integration

---

## 15. Git Workflow

- Branch: `main` (production), `develop` (integration), `feature/*`, `fix/*`
- Commit convention: `feat:`, `fix:`, `chore:`, `migration:`, `refactor:`
- Each phase gets its own PR against `develop`
- Migration files: never edit after merge — create new migration to amend

---

## 16. Definition of Done (per phase)

Before marking a phase complete:
- [ ] TypeScript compiles with zero errors (`pnpm type-check`)
- [ ] ESLint passes with zero warnings
- [ ] All new DB migrations applied and tested locally
- [ ] RLS tested: user A cannot access user B's organization data
- [ ] Audit logs written for all state-changing operations
- [ ] No `console.log` left in production code paths
- [ ] `.env.example` updated if new variables added
- [ ] README updated with setup instructions for the phase

---

*End of Vexera scaffold prompt. Begin with Phase 0.*
