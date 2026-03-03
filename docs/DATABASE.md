# Database

Vexera uses **Supabase** (PostgreSQL) as its database. This document explains the schema, how tables relate to each other, and how Row Level Security (RLS) keeps organization data isolated.

---

## How to Apply Migrations

Migrations are SQL files in `supabase/migrations/`. They run in numeric order. To apply them:

```bash
# Link your local CLI to your Supabase cloud project
supabase link --project-ref your-project-ref

# Apply all unapplied migrations
supabase db push
```

> **Never edit a migration file after it has been pushed.** If you need to change the schema, create a new migration file with the next number.

---

## Entity Relationship Overview

```
auth.users (Supabase built-in)
    │
    ▼
profiles           ← one profile per user
    │
    ├──► organization_members ◄─── organizations
    │                                    │
    │                                    ├──► invoices
    │                                    │       └──► invoice_items
    │                                    ├──► documents
    │                                    ├──► ledger_entries
    │                                    ├──► chart_of_accounts (org-specific)
    │                                    ├──► invitations
    │                                    ├──► accountant_clients
    │                                    ├──► subscriptions
    │                                    └──► audit_logs
    │
    └──► accountant_clients (as accountant)

chart_of_accounts  ← system-level rows (organization_id IS NULL)
```

---

## Tables

### `profiles`

Stores public user info. Created automatically when a user signs up via the `handle_new_user()` trigger.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | FK → `auth.users.id`, primary key |
| `email` | TEXT | User's email |
| `full_name` | TEXT | Display name |
| `avatar_url` | TEXT | Profile picture URL |
| `phone` | TEXT | Optional phone |
| `created_at` | TIMESTAMPTZ | |
| `updated_at` | TIMESTAMPTZ | Auto-updated by trigger |

> **Why a separate `profiles` table?** Supabase's `auth.users` is internal and can't be read by the app directly. `profiles` is a public mirror with only the fields the app needs.

---

### `organizations`

The core multi-tenant entity. Every piece of business data belongs to an organization.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `name` | TEXT | Company name |
| `ico` | TEXT | 8-digit Slovak company ID |
| `dic` | TEXT | 10-digit tax ID (optional) |
| `ic_dph` | TEXT | VAT ID, format: `SK` + 10 digits (optional) |
| `address_street/city/zip/country` | TEXT | Address fields |
| `email`, `phone`, `website` | TEXT | Contact info |
| `bank_iban`, `bank_swift` | TEXT | Banking details |
| `logo_url` | TEXT | Company logo |
| `subscription_plan` | TEXT | One of: `free`, `freelancer`, `small_business`, `medium_business`, `accounting_firm` |
| `storage_used_bytes` | BIGINT | Tracks file storage usage |
| `peppol_endpoint_id`, `peppol_scheme` | TEXT | e-Invoicing configuration |
| `deleted_at` | TIMESTAMPTZ | Soft delete |

---

### `organization_members`

Links users to organizations with a role.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK → `organizations` |
| `user_id` | UUID | FK → `profiles` |
| `role` | TEXT | `owner`, `admin`, or `member` |
| `created_at` | TIMESTAMPTZ | |

**Roles:**
- `owner` — created the org, full control
- `admin` — can manage members and settings
- `member` — can work with data but not change org settings

**Unique constraint:** `(organization_id, user_id)` — a user can only be a member of an org once.

---

### `invitations`

Allows org admins to invite new users by email.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK → `organizations` |
| `invited_by` | UUID | FK → `profiles` (who sent it) |
| `invited_email` | TEXT | Email of the invitee |
| `role` | TEXT | `accountant`, `admin`, or `member` |
| `token` | TEXT | Unique random hex string (32 bytes) |
| `status` | TEXT | `pending`, `accepted`, `expired`, `revoked` |
| `expires_at` | TIMESTAMPTZ | Default: 7 days from creation |

The invite link looks like: `/invite/<token>`

---

### `accountant_clients`

Allows an accountant (external user) to access a client's organization without being a member. Uses granular JSONB permissions.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `accountant_id` | UUID | FK → `profiles` (the accountant) |
| `organization_id` | UUID | FK → `organizations` (the client) |
| `status` | TEXT | `pending`, `active`, `revoked` |
| `permissions` | JSONB | Object: `{ view_invoices, close_invoices, manage_ledger, view_documents, upload_documents }` |

**Permissions example:**
```json
{
  "view_invoices": true,
  "close_invoices": true,
  "manage_ledger": true,
  "view_documents": true,
  "upload_documents": false
}
```

---

### `chart_of_accounts`

Slovak accounting chart (Účtovná osnova). Contains both system-wide defaults and org-specific overrides.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `organization_id` | UUID | NULL for system defaults, org UUID for overrides |
| `code` | TEXT | Account number (e.g. `311`, `601`) |
| `name` | TEXT | Account name |
| `account_type` | TEXT | `asset`, `liability`, `equity`, `revenue`, `expense`, `off_balance` |
| `parent_id` | UUID | Self-referential for hierarchy |
| `is_system` | BOOLEAN | TRUE for system defaults |
| `is_active` | BOOLEAN | Can be deactivated |

**System accounts** (seeded in migration 015) have `organization_id = NULL` and `is_system = TRUE`. Any authenticated user can read them. Org-specific overrides are only visible to members of that org.

---

### `invoices`

The core business entity. Supports both issued (sales) and received (purchase) invoices.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK → `organizations` |
| `invoice_number` | TEXT | e.g. `2025-001` |
| `invoice_type` | TEXT | `issued` (you send it) or `received` (you get it) |
| `status` | TEXT | `draft` → `sent` → `paid` / `overdue` / `cancelled` / `closed` |
| `supplier_*` | TEXT | Supplier fields (name, ICO, DIC, address, IBAN) |
| `customer_*` | TEXT | Customer fields |
| `issue_date`, `delivery_date`, `due_date` | DATE | Key dates |
| `paid_at` | TIMESTAMPTZ | When payment was received |
| `subtotal`, `vat_amount`, `total` | DECIMAL(15,2) | Monetary totals |
| `currency` | TEXT | Default `EUR` |
| `payment_method` | TEXT | `bank_transfer`, `cash`, `card`, `other` |
| `variable_symbol`, `constant_symbol`, `specific_symbol` | TEXT | Slovak banking payment identifiers |
| `file_path`, `file_url` | TEXT | S3 key and public URL of PDF |
| `peppol_*` | TEXT | e-Invoicing fields |

**Status lifecycle:**
```
draft ──► sent ──► paid
              └──► overdue
              └──► cancelled
              └──► closed (by accountant)
```

**Unique constraint:** `(organization_id, invoice_number, invoice_type)` — invoice numbers must be unique per org per type.

---

### `invoice_items`

Line items for invoices. Each row is one product/service on the invoice.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `invoice_id` | UUID | FK → `invoices` |
| `description` | TEXT | What was sold |
| `quantity` | DECIMAL(10,4) | Amount (supports fractions, e.g. `1.5` hours) |
| `unit` | TEXT | Unit of measure (e.g. `ks`, `hod`, `m²`) |
| `unit_price_net` | DECIMAL(15,2) | Price per unit (excl. VAT) |
| `vat_rate` | SMALLINT | VAT rate: `0`, `5`, `10`, or `20` |
| `vat_amount` | DECIMAL(15,2) | Computed VAT for this line |
| `total_net` | DECIMAL(15,2) | `quantity × unit_price_net` |
| `total_gross` | DECIMAL(15,2) | `total_net + vat_amount` |
| `account_code` | TEXT | Chart of accounts code (e.g. `601`) |
| `sort_order` | INT | Display order on the invoice |

---

### `documents`

File storage metadata. The actual file is in S3; only the reference is stored here.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK → `organizations` |
| `invoice_id` | UUID | Optional FK → `invoices` |
| `document_type` | TEXT | `invoice_issued`, `invoice_received`, `receipt`, `contract`, `bank_statement`, `tax_document`, `other` |
| `name` | TEXT | Display name |
| `file_path` | TEXT | S3 key (used to generate presigned URLs) |
| `file_size_bytes` | BIGINT | Used to track `storage_used_bytes` on org |
| `mime_type` | TEXT | e.g. `application/pdf` |
| `ocr_status` | TEXT | `not_queued`, `queued`, `processing`, `done`, `failed` |
| `ocr_text` | TEXT | Extracted text from OCR |
| `retention_until` | DATE | Mandatory retention date (Slovak law: 10 years for invoices) |
| `archived_at` | TIMESTAMPTZ | When moved to cold storage |

---

### `ledger_entries`

Double-entry accounting records. Every financial event must have equal debits and credits.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK → `organizations` |
| `invoice_id` | UUID | Optional link to invoice |
| `document_id` | UUID | Optional link to document |
| `entry_date` | DATE | Accounting date |
| `period_year` | SMALLINT | **Generated** from `entry_date` |
| `period_month` | SMALLINT | **Generated** from `entry_date` |
| `description` | TEXT | Human-readable description |
| `debit_account_number` | TEXT | Account code being debited (MD) |
| `credit_account_number` | TEXT | Account code being credited (D) |
| `amount` | DECIMAL(15,2) | Must be > 0 |
| `status` | TEXT | `draft` → `posted` → `reversed` |
| `reversed_by` | UUID | Self-referential FK to reversal entry |

**Double-entry rule:** For every entry, `debit_amount = credit_amount`. Debits increase assets and expenses; credits increase liabilities, equity, and revenue.

---

### `audit_logs`

Immutable record of all important actions. **Never updated or deleted.**

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK → `organizations` |
| `user_id` | UUID | Who did it |
| `action` | TEXT | e.g. `invoice.created`, `member.removed` |
| `entity_type` | TEXT | e.g. `invoice`, `organization` |
| `entity_id` | UUID | Which record was affected |
| `old_data` | JSONB | State before the change |
| `new_data` | JSONB | State after the change |
| `metadata` | JSONB | Extra context (IP, user agent, etc.) |
| `created_at` | TIMESTAMPTZ | |

RLS: `INSERT` allowed, but `UPDATE` and `DELETE` policies are never created — the DB enforces immutability.

---

### `subscriptions`

Stripe subscription data per organization (scaffolded, not yet active).

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `organization_id` | UUID | FK → `organizations` |
| `stripe_customer_id` | TEXT | Stripe customer reference |
| `stripe_subscription_id` | TEXT | Stripe subscription reference |
| `plan` | TEXT | Current plan |
| `status` | TEXT | `active`, `past_due`, `cancelled`, `trialing`, `incomplete` |
| `current_period_start/end` | TIMESTAMPTZ | Billing period |
| `cancel_at` | TIMESTAMPTZ | If scheduled for cancellation |

---

## Row Level Security (RLS)

RLS is a PostgreSQL feature that filters rows automatically based on the current user. Think of it as a WHERE clause that's automatically applied to every query.

### How it works

```sql
-- This policy is ALWAYS applied, even if the app forgets to filter
CREATE POLICY "invoices_select" ON invoices FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));
```

When your app runs `SELECT * FROM invoices`, PostgreSQL silently adds:
```sql
WHERE organization_id = ANY(get_accessible_organization_ids())
```

The user can never see invoices from other organizations.

### Helper functions

Three helper functions return the org IDs the current user can access:

```sql
-- Orgs where the user is a direct member (owner/admin/member)
get_user_organization_ids() → UUID[]

-- Orgs where the user is an active accountant
get_accountant_organization_ids() → UUID[]

-- Union of both (most permissive, read-only for accountants)
get_accessible_organization_ids() → UUID[]
```

### Policy matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| `profiles` | own row + org members | own row only | own row only | — |
| `organizations` | member/accountant orgs | any auth user | member orgs | — |
| `organization_members` | member/accountant orgs | member orgs or self | — | member orgs |
| `invoices` | accessible orgs | member orgs | member orgs (non-closed) | — |
| `invoice_items` | via invoice | via invoice | via invoice | via invoice |
| `documents` | accessible orgs | member orgs | member orgs | — |
| `ledger_entries` | accessible orgs | accessible orgs | accessible (draft only) | — |
| `chart_of_accounts` | system + accessible orgs | member orgs | member orgs (non-system) | — |
| `audit_logs` | accessible orgs | any auth user | **never** | **never** |

---

## Migrations Reference

| # | File | What it does |
|---|---|---|
| 001 | `extensions_helpers.sql` | Installs `uuid-ossp`, `pgcrypto`; creates `update_updated_at_column()` trigger |
| 002 | `profiles.sql` | `profiles` table + `handle_new_user` trigger |
| 003 | `organizations.sql` | `organizations` table |
| 004 | `organization_members.sql` | `organization_members` table |
| 005 | `invitations.sql` | `invitations` table |
| 006 | `accountant_clients.sql` | `accountant_clients` table |
| 007 | `chart_of_accounts.sql` | `chart_of_accounts` table |
| 008 | `invoices.sql` | `invoices` table |
| 009 | `invoice_items.sql` | `invoice_items` table |
| 010 | `documents.sql` | `documents` table |
| 011 | `ledger_entries.sql` | `ledger_entries` table |
| 012 | `audit_logs.sql` | `audit_logs` table |
| 013 | `subscriptions.sql` | `subscriptions` table |
| 014 | `rls_policies.sql` | All RLS policies + helper functions |
| 015 | `seed_chart_of_accounts.sql` | Slovak chart of accounts (system data) |
| 016 | `fix_profiles_rls.sql` | INSERT policy on profiles (for legacy users) |

---

## Generating TypeScript Types

After any schema change, regenerate the TypeScript types:

```bash
supabase gen types typescript --project-id your-project-ref > packages/types/src/database.types.ts
```

This updates `database.types.ts` with the exact shape of every table. The `Database` type is used throughout the app to get autocomplete and type safety on Supabase queries.
