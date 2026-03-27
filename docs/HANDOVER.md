# VEXERA - Complete Project Documentation

**Version:** 1.0 MVP
**Date:** March 2026
**Repository:** `github.com/david-brezula/VEXERA`
**Branch:** `feat/role-based-onboarding`

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [Technology Stack](#2-technology-stack)
3. [Architecture](#3-architecture)
4. [Getting Started](#4-getting-started)
5. [Environment Variables](#5-environment-variables)
6. [Database Schema](#6-database-schema)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Feature Modules](#8-feature-modules)
9. [API Reference](#9-api-reference)
10. [Frontend Pages](#10-frontend-pages)
11. [Shared Packages](#11-shared-packages)
12. [Background Jobs & Edge Functions](#12-background-jobs--edge-functions)
13. [Security Model](#13-security-model)
14. [Deployment](#14-deployment)
15. [Known Limitations & Roadmap](#15-known-limitations--roadmap)

---

## 1. Product Overview

VEXERA is a **standalone multi-tenant cloud accounting platform** built to replace legacy accounting software in the Slovak market (Pohoda, Money S3, KROS, Omega). It combines full accounting functionality with AI-powered automation in a modern cloud-native architecture.

### What it does

- **Complete accounting** — invoicing, double-entry ledger, chart of accounts, VAT returns, tax compliance
- **AI-powered automation** — OCR document processing, smart categorization, bank reconciliation, recurring pattern detection
- **Real-time financial picture** — P&L, VAT position, cashflow forecasts, tax estimates
- **Shared workspace** — connects entrepreneurs and accountants in one platform, replacing email/Excel workflows
- **Slovak tax compliance** — VAT returns (KV DPH, DP DPH), income tax calculations, Peppol e-invoicing

### Target users

| Persona | Role | Primary needs |
|---------|------|---------------|
| **Martina** | Accounting firm owner | Handle 2x clients without 2x staff. Replace Pohoda/Money across all clients with one platform. |
| **Peter** | Senior accountant | System handles extraction, he confirms exceptions. Full accounting in one tool. |
| **Jakub** | Entrepreneur / business owner | Issue invoices, upload documents, see P&L and tax estimate instantly. No legacy software needed. |

### Organization types

| Type | Description |
|------|-------------|
| `freelancer` | Sole trader (SZCO) with flat expense or cost-based tax regime |
| `company` | s.r.o. or similar legal entity |
| `accounting_firm` | Manages multiple client organizations |

---

## 2. Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.x |
| Language | TypeScript (strict mode) | 5.x |
| Runtime | React | 19.x |
| Styling | Tailwind CSS + shadcn/ui | v4 |
| Database | Supabase (PostgreSQL) | Cloud |
| Auth | Supabase Auth (httpOnly cookies) | - |
| State management | TanStack Query (React Query) | - |
| Forms | React Hook Form + Zod | v4 |
| File storage | AWS S3 (presigned URLs) | - |
| Email | Resend API | - |
| OCR | Google Vision API | - |
| PDF | React-PDF + QR code generation | - |
| Charts | Recharts | - |
| Monorepo | pnpm workspaces + Turborepo | - |
| E2E testing | Playwright | - |

---

## 3. Architecture

### 3.1 Monorepo structure

```
vexera/
  apps/
    web/                          # Next.js application
      src/
        app/                      # Pages and API routes (App Router)
          (auth)/                  # Public auth pages (login, register, invite)
          (dashboard)/            # Protected pages (sidebar + header layout)
          api/                    # REST API routes
        features/                 # Feature-slice modules (primary code)
          auth/                   # Auth schemas
          bank/                   # Bank import, reconciliation
          chat/                   # AI assistant
          contacts/               # Contact/client management
          documents/              # Upload, OCR, duplicate detection
          export/                 # Export adapters, XML generators
          invoices/               # CRUD, PDF, recurring, payments
          ledger/                 # Journal entries, chart of accounts
          notifications/          # Gmail, email tracking, in-app
          onboarding/             # Setup wizard
          products/               # Product/service catalog
          reports/                # Dashboard, VAT, cashflow, analytics
          rules/                  # IF-THEN engine, categorization ML
          settings/               # Org settings, members, archive
        shared/                   # Cross-cutting concerns
          components/             # UI (shadcn/ui), charts, layout
          hooks/                  # Shared React hooks
          lib/                    # api-utils, query-keys
          services/               # audit, legislative, queue, tags
        lib/                      # Low-level utilities
          crypto.ts               # AES-256-GCM encrypt/decrypt
          env.ts                  # Validated environment variables
          s3/                     # S3 client + key generation
          supabase/               # Supabase client/server/middleware
        providers/                # React context providers
  packages/
    types/                        # @vexera/types (shared TypeScript types)
    utils/                        # @vexera/utils (formatEur, VAT, tax calculations)
  supabase/
    migrations/                   # 56 SQL migration files
    functions/                    # Edge Functions (poll-gmail, process-ocr, etc.)
  tests/
    security/                     # Tenant isolation tests
  docs/                           # Architecture, database, development docs
```

### 3.2 Data flow patterns

- **Server Components** fetch data directly via Supabase server client (`features/*/data.ts`)
- **Client Components** use TanStack Query hooks (`features/*/hooks.ts`) via Supabase browser client
- **Write operations** use Next.js Server Actions (`features/*/actions.ts`)
- **REST API routes** handle external integrations (webhooks, OAuth callbacks, file upload)

### 3.3 Provider stack

```
RootLayout
  SupabaseProvider          (auth session, Supabase browser client)
    QueryProvider           (TanStack Query — 60s staleTime, no refetch-on-focus)
      OrganizationProvider  (active org from cookie, org switching)
        Pages
```

### 3.4 Multi-tenancy

- Every database table has `organization_id` with index
- Row Level Security (RLS) enforces tenant isolation at the database level
- `organization_id` always comes from authenticated JWT, never from request body
- Three RLS helper functions control access:
  - `get_user_organization_ids()` — orgs where user is a direct member
  - `get_accountant_organization_ids()` — orgs where user is an external accountant
  - `get_accessible_organization_ids()` — union of both

---

## 4. Getting Started

### Prerequisites

- Node.js 20+
- pnpm (`npm install -g pnpm`)
- A Supabase project (cloud or local)
- Supabase CLI

### Installation

```bash
git clone https://github.com/david-brezula/VEXERA.git
cd vexera
pnpm install
```

### Environment setup

```bash
cp apps/web/.env.example apps/web/.env.local
```

Fill in the required variables (see [Section 5](#5-environment-variables)).

### Database setup

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### Development

```bash
pnpm dev                    # Start dev server (Turbopack)
pnpm type-check             # TypeScript check (preferred over build)
pnpm lint                   # ESLint across all packages
```

### Common commands

```bash
pnpm --filter @vexera/web <command>   # Run for web app only
supabase db push                       # Apply migrations
supabase gen types typescript --project-id <ref> > packages/types/src/database.types.ts

# Clear Next.js cache (if app behaves strangely)
rm -rf apps/web/.next && pnpm dev
```

---

## 5. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anonymous key (safe for browser) |
| `SUPABASE_SERVICE_ROLE_KEY` | For API routes | Full DB access (never expose to browser) |
| `AWS_REGION` | For file uploads | S3 region (e.g. `eu-central-1`) |
| `AWS_ACCESS_KEY_ID` | For file uploads | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | For file uploads | AWS credentials |
| `AWS_S3_BUCKET_NAME` | For file uploads | S3 bucket name |
| `NEXT_PUBLIC_APP_URL` | No | Public app URL (default: `http://localhost:3000`) |
| `ENCRYPTION_KEY` | For Gmail | AES-256 hex key for OAuth token encryption |
| `GMAIL_CLIENT_ID` | For Gmail | Google OAuth2 client ID |
| `GMAIL_CLIENT_SECRET` | For Gmail | Google OAuth2 client secret |
| `GMAIL_REDIRECT_URI` | For Gmail | e.g. `https://app.vexera.sk/api/email/callback` |
| `GOOGLE_VISION_API_KEY` | For OCR | Google Cloud Vision API key |
| `RESEND_API_KEY` | For email | Resend email service API key |
| `ANTHROPIC_API_KEY` | For AI chat | Claude API key |
| `CRON_SECRET` | For cron jobs | Secret for authenticating cron endpoints |
| `QUEUE_PROCESS_SECRET` | For job queue | Secret for queue processing endpoint |
| `SMTP_HOST` | For SMTP email | SMTP server host |
| `SMTP_USER` | For SMTP email | SMTP username |
| `SMTP_PASS` | For SMTP email | SMTP password |
| `SMTP_FROM` | For SMTP email | Sender email address |
| `SMTP_PORT` | For SMTP email | SMTP port |

> Variables starting with `NEXT_PUBLIC_` are visible in the browser. Never put secrets in them.

---

## 6. Database Schema

### 6.1 Tables (35 total)

| Table | Purpose |
|-------|---------|
| `profiles` | User profiles (synced from auth.users via trigger) |
| `organizations` | Tenant entities (companies, freelancers, accounting firms) |
| `organization_members` | User-to-org membership with roles |
| `invitations` | Email-based team invitations with tokens |
| `accountant_clients` | External accountant access with JSONB permissions |
| `chart_of_accounts` | Slovak chart of accounts (system + org-specific) |
| `invoices` | Issued and received invoices with Peppol fields |
| `invoice_items` | Line items per invoice with per-line VAT |
| `invoice_payments` | Partial/overpayment tracking |
| `documents` | Uploaded files (metadata in DB, file in S3) with OCR status |
| `journal_entries` | Parent entity for grouped ledger entries |
| `ledger_entries` | Double-entry accounting records (debit/credit) |
| `bank_accounts` | Registered bank accounts per organization |
| `bank_transactions` | Imported transactions with match status |
| `rules` | IF-THEN categorization rules (AND/OR logic) |
| `rule_applications` | History of rule executions |
| `recurring_patterns` | Detected recurring payment patterns for cashflow |
| `vat_returns` | Quarterly VAT calculations by rate (23%, 19%, 5%) |
| `export_jobs` | Async export job queue (Pohoda, Money S3, KROS, CSV) |
| `email_connections` | Gmail OAuth tokens (AES-256 encrypted) |
| `email_imports` | Processed email messages with deduplication |
| `notifications` | In-app notification feed per user |
| `audit_logs` | Immutable action log (INSERT only, no UPDATE/DELETE) |
| `subscriptions` | Stripe subscription data |
| `contacts` | Client/supplier directory |
| `products` | Product/service catalog |
| `tags` | Polymorphic tags (client, project, custom) |
| `entity_tags` | Tag-to-entity associations |
| `recurring_invoice_templates` | Templates for auto-generated invoices |
| `chat_sessions` | AI chatbot conversation sessions |
| `chat_messages` | Chat message history |
| `job_queue` | Generic async job queue |
| `analytics_events` | Product analytics event tracking |
| `fiscal_periods` | Accounting period locking |
| `organization_ledger_settings` | Default accounts for auto-posting |

### 6.2 Migrations

56 migration files in `supabase/migrations/`, numbered `20240101000001` through `20240101000056`. Each migration is idempotent and includes RLS policies for any new tables.

### 6.3 Key relationships

```
organizations
  ├── organization_members (user_id → profiles)
  ├── accountant_clients (accountant_user_id → profiles)
  ├── invoices
  │     ├── invoice_items (→ products)
  │     ├── invoice_payments
  │     └── documents (invoice_id FK)
  ├── bank_accounts
  │     └── bank_transactions (matched_invoice_id → invoices)
  ├── rules → rule_applications
  ├── contacts (referenced by invoices.contact_id)
  ├── products (referenced by invoice_items.product_id)
  ├── journal_entries → ledger_entries
  ├── vat_returns
  ├── recurring_patterns
  ├── export_jobs
  ├── email_connections → email_imports
  ├── notifications
  └── audit_logs
```

---

## 7. Authentication & Authorization

### 7.1 Auth flow

1. User registers at `/register` (email + password via Supabase Auth)
2. `handle_new_user()` trigger creates a `profiles` row
3. User redirected to `/onboarding` to create their first organization
4. JWT httpOnly cookie issued, refreshed automatically by Supabase client

### 7.2 Route protection

**Middleware** (`src/middleware.ts`) protects all routes:

- Unauthenticated users on protected routes are redirected to `/login`
- Authenticated users without an active organization are redirected to `/onboarding`
- API requests without auth receive `401 JSON`
- Security headers applied: CSP, X-Frame-Options: DENY, nosniff, strict referrer

### 7.3 Roles

| Role | Scope | Capabilities |
|------|-------|-------------|
| `owner` | Organization | Full control (created the org) |
| `admin` | Organization | Manage members and settings |
| `member` | Organization | Work with data, no settings |
| `accountant` | External | Via `accountant_clients` table, granular JSONB permissions |

### 7.4 Row Level Security

All 34 data tables have RLS policies. Key principles:

- SELECT: user must be a member or accountant of the organization
- INSERT: user must be a direct member (not accountant, except where noted)
- UPDATE: restricted by entity status (e.g., can't update closed invoices)
- DELETE: restricted to draft/unpublished entities
- audit_logs: INSERT allowed, UPDATE/DELETE never

---

## 8. Feature Modules

Each feature lives in `apps/web/src/features/<name>/` with a consistent structure:

| File | Purpose |
|------|---------|
| `index.ts` | Barrel export |
| `service.ts` | Business logic (server-side) |
| `data.ts` | Server-side data fetching for Server Components |
| `actions.ts` | Next.js Server Actions (mutations) |
| `hooks.ts` | TanStack Query hooks (client-side) |
| `schemas.ts` | Zod validation schemas |
| `components/` | React components specific to this feature |

### 8.1 Invoices (`features/invoices/`)

Full invoice lifecycle: create, edit, send, track payments, close.

- **PDF generation** with QR payment codes (Slovak banking standard)
- **Recurring invoices** via templates with configurable frequency
- **E-invoicing** support (Peppol UBL import/export)
- **Email sending** with open tracking via pixel
- **Partial payments** tracking with remaining amount calculation
- **Auto-numbering** with configurable format per organization

### 8.2 Documents (`features/documents/`)

Document upload and processing pipeline.

- **Upload** via S3 presigned URLs (max 20MB, PDF/JPEG/PNG/WebP/Excel)
- **OCR** via Google Vision API (async, queued)
- **Duplicate detection** by file hash, supplier+amount+date
- **Status workflow**: New → Auto-processed → Awaiting Review → Approved → Archived
- **Smart categorization** learns from accountant corrections (multi-factor ML scoring)

### 8.3 Bank (`features/bank/`)

Bank statement import and payment reconciliation.

- **CSV and MT940** parser for Slovak bank formats
- **Auto-reconciliation** by variable symbol (VS) + amount matching
- **Three confidence levels**: high (VS + amount), medium (VS only), low (amount only)
- **Recurring pattern detection** from transaction history
- **Manual matching** and ignore options

### 8.4 Rules Engine (`features/rules/`)

IF-THEN rule system for automatic categorization.

- **Targets**: documents and bank transactions
- **Conditions**: equals, contains, starts_with, gt/lt/gte/lte (10 operators)
- **Logic**: AND/OR grouping
- **Actions**: set_category, set_account, set_document_type, set_tag
- **Priority ordering** with first-match-wins semantics
- **Test mode** to preview which entities would match before activating

### 8.5 Reports & Tax (`features/reports/`)

Financial dashboards and tax compliance.

- **Entrepreneur dashboard**: revenue, expenses, profit, VAT position, 6-month trend
- **Accountant dashboard**: client overview, auto-process rates, workload metrics
- **VAT returns**: quarterly calculation by rate (23%, 19%, 5%), drill-down to source documents
- **Cashflow forecasting**: based on open invoices + detected recurring patterns + what-if scenarios
- **Category reports**: spending breakdown by category
- **Client/project P&L**: profitability per client or project tag
- **Income tax**: freelancer tax calculator with Slovak 2026 legislation (flat expenses, progressive brackets, nezdanitelna, insurance)
- **Health checks**: automated data quality validation

### 8.6 Contacts (`features/contacts/`)

Client and supplier directory.

- **Auto-import** from existing invoices
- **ICO lookup** against Slovak business registry (ORSR/ZRSR)
- **Link to invoices** via contact_id for reporting

### 8.7 Products (`features/products/`)

Product/service catalog for quick invoice item entry.

- Predefined items with default price, VAT rate, unit
- Revenue statistics per product

### 8.8 Export (`features/export/`)

Tax filings, e-invoicing, and data portability.

- **KV DPH XML** — VAT control statement for Slovak tax authority (direct filing)
- **DP DPH XML** — VAT return filing
- **Peppol UBL XML** — EU e-invoice standard (import and export)
- **Excel/CSV** — generic data export for analysis or migration
- **PDF reports** — category breakdown and P&L
- **Audit bundle** — complete document package for external auditors
- **Legacy format export** — Pohoda/Money S3/KROS format for clients migrating from legacy systems

### 8.9 Ledger (`features/ledger/`)

Double-entry accounting engine.

- **Journal entries** with grouped debit/credit lines
- **Chart of accounts** (Slovak standard, customizable per org)
- **Fiscal periods** with lock/unlock
- **Trial balance** via `get_account_balances()` database function
- **Default account settings** per organization

### 8.10 Notifications (`features/notifications/`)

Communication and alerting.

- **Gmail integration**: OAuth2 connection, auto-poll attachments every 15 min
- **In-app notifications**: bell icon with unread count
- **Email sending** via Resend API with delivery tracking
- **Email open tracking** via pixel

### 8.11 Chat (`features/chat/`)

AI-powered assistant using Claude API.

- Provides organization context (invoices, documents, bank data)
- Session management with conversation history
- Suggestion chips for common queries

### 8.12 Settings (`features/settings/`)

Organization management.

- **Member management**: invite by email, role assignment
- **Accountant invitations**: separate flow with granular permissions
- **Invoice template** customization (logo, colors, layout)
- **Data retention** policies and document archival
- **Organization profile**: company details, IČO, DIČ, IČ DPH

---

## 9. API Reference

### 9.1 Authentication

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/auth/callback` | Supabase OAuth callback |

### 9.2 Invoices

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/invoices` | List invoices (pagination, filters) |
| POST | `/api/invoices` | Create invoice |
| GET | `/api/invoices/[id]/pdf` | Generate PDF |
| GET | `/api/recurring-invoices` | List recurring templates |
| POST | `/api/recurring-invoices` | Create template |
| GET/PATCH/DELETE | `/api/recurring-invoices/[id]` | Template CRUD |

### 9.3 Bank

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST/PATCH/DELETE | `/api/bank/accounts` | Bank account CRUD |
| POST | `/api/bank/import` | Import CSV/MT940 statement |
| GET | `/api/bank/transactions` | List transactions |
| PATCH | `/api/bank/transactions/[id]/match` | Manual match |
| GET | `/api/bank/reconcile` | Get match suggestions |
| POST | `/api/bank/reconcile` | Run auto-reconciliation |

### 9.4 Documents

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/documents` | List documents |
| POST | `/api/documents` | Upload document (enqueue OCR) |
| POST | `/api/storage/upload` | Get presigned upload URL |
| GET | `/api/storage/download` | Get presigned download URL |

### 9.5 Contacts & Products

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/contacts` | List / create contacts |
| GET/PATCH/DELETE | `/api/contacts/[id]` | Contact CRUD |
| POST | `/api/contacts/import` | Auto-import from invoices |
| GET | `/api/contacts/lookup` | ICO registry lookup |
| GET/POST | `/api/products` | List / create products |
| GET/PATCH/DELETE | `/api/products/[id]` | Product CRUD |

### 9.6 Rules

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/rules` | List / create rules |
| GET/PATCH/DELETE | `/api/rules/[id]` | Rule CRUD |
| POST | `/api/rules/apply` | Batch apply rules |
| GET | `/api/categorization/insights` | ML categorization insights |

### 9.7 Reports & Tax

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/cashflow` | Cashflow forecast + patterns |
| GET/POST | `/api/vat` | VAT position / recalculate |
| GET | `/api/reports/category` | Category breakdown |
| GET | `/api/reports/client-pl` | Client/project P&L |
| GET | `/api/reports/remaining-work` | Accountant work queue |
| POST | `/api/analytics` | Log analytics event |

### 9.8 Notifications & Email

| Method | Route | Purpose |
|--------|-------|---------|
| GET/PATCH | `/api/notifications` | List / mark-read |
| POST | `/api/email/connect` | Start Gmail OAuth flow |
| GET | `/api/email/callback` | Gmail OAuth callback |
| GET | `/api/email/tracking` | Email delivery tracking |
| GET | `/api/email/track/[pixelId]` | Open tracking pixel |

### 9.9 Other

| Method | Route | Purpose |
|--------|-------|---------|
| GET/POST | `/api/export` | List / create export jobs |
| GET/POST | `/api/payments` | List / record payments |
| GET/POST/PATCH | `/api/archive` | Retention policies |
| GET/POST | `/api/chat` | AI chat |
| GET | `/api/chat/sessions` | List chat sessions |
| GET/POST | `/api/health-checks` | Data quality checks |
| GET/POST | `/api/tags` | Tag management |
| GET | `/api/accountant-needs` | What accountant needs |
| POST | `/api/webhooks/stripe` | Stripe webhook |
| POST | `/api/webhooks/resend` | Resend webhook |

---

## 10. Frontend Pages

### 10.1 Public pages

| URL | Page |
|-----|------|
| `/login` | User login |
| `/register` | New account registration |
| `/invite/[token]` | Accept team invitation |

### 10.2 Dashboard pages (protected)

| URL | Page | Key components |
|-----|------|---------------|
| `/dashboard` | Main dashboard | Financial overview, cashflow widget, VAT widget |
| `/accountant` | Accountant dashboard | Client list, workload metrics, auto-process rates |
| `/invoices` | Invoice list | Filterable table, status badges |
| `/invoices/new` | Create invoice | Full form with item editor, contact lookup, QR code |
| `/invoices/[id]` | Invoice detail | Actions bar, payment history, linked documents |
| `/invoices/[id]/print` | Print preview | PDF-ready layout |
| `/invoices/recurring` | Recurring templates | Template table, toggle active/inactive |
| `/documents` | Document list | Grid/table view, upload button, status filters |
| `/documents/[id]` | Document detail | OCR review, correction form, comments |
| `/bank` | Bank management | Transactions table, import wizard, reconciliation panel |
| `/contacts` | Contact directory | Search, ICO lookup, import from invoices |
| `/products` | Product catalog | CRUD table with pricing |
| `/rules` | Categorization rules | Rule builder with test mode |
| `/ledger` | General ledger | Journal entries, chart of accounts, trial balance |
| `/reports` | Reports menu | Links to all report types |
| `/reports/cashflow` | Cashflow forecast | Area chart, scenarios, risk date |
| `/reports/categories` | Category breakdown | Bar chart, drilldown |
| `/reports/client-pl` | Client P&L | Per-client profitability |
| `/reports/project-pl` | Project P&L | Per-project profitability |
| `/reports/remaining-work` | Remaining work | Accountant task queue |
| `/tax/income` | Income tax | Freelancer calculator, bracket breakdown |
| `/tax/vat` | VAT overview | Quarterly timeline, rate breakdown |
| `/tax/vat/[year]/[month]` | VAT detail | Monthly drill-down |
| `/export` | Export jobs | Job list, trigger new export |
| `/inbox` | Document inbox | Accountant work queue |
| `/chat` | AI assistant | Chat interface with suggestions |
| `/onboarding` | Setup wizard | 5-step org creation |
| `/health-checks` | Data quality | Automated validation results |
| `/settings` | Organization settings | Company profile, email connection |
| `/settings/members` | Team members | Invite, roles, accountant access |
| `/settings/billing` | Subscription | Plan management |
| `/settings/invoice-template` | Invoice design | Logo, colors, layout |
| `/settings/archive` | Data retention | Archive policies |

---

## 11. Shared Packages

### 11.1 @vexera/types (`packages/types/`)

All shared TypeScript types. Key exports:

- **Enums**: `OrganizationRole`, `InvoiceStatus`, `DocumentStatus`, `InvoiceType`, `PaymentMethod`, `OcrStatus`, `BankTransactionMatchStatus`, `RuleOperator`, `ExportFormat`, `NotificationType`, `VatReturnStatus`
- **Interfaces**: `BankTransaction`, `Rule`, `RuleCondition`, `Notification`, `ExportJob`, `VatReturn`, `RecurringPattern`, `FreelancerProfile`, `CompanyProfile`, `SlovakTaxLegislation`
- **Constants**: `VAT_RATES = [23, 19, 5, 0]`

### 11.2 @vexera/utils (`packages/utils/`)

Shared utility functions:

| Function | Description |
|----------|-------------|
| `formatEur(amount)` | Format as `"1 234,56 EUR"` (Slovak locale) |
| `formatDecimal(amount)` | Format with 2 decimal places |
| `parseMonetary(value)` | Parse string to number |
| `calculateVatAmount(net, rate)` | Net amount * VAT rate |
| `calculateGrossAmount(net, rate)` | Net + VAT |
| `calculateNetFromGross(gross, rate)` | Reverse VAT calculation |
| `calculateFreelancerTaxV2(income, profile, year)` | Full Slovak freelancer tax calculation |
| `calculateProgressiveTax(base, legislation)` | Tax bracket calculation |
| `calculateInsurance(profile, legislation)` | Social + health insurance |
| `getLegislation(year)` | Get Slovak tax rules for a given year |

### Slovak VAT rates (2025+)

| Rate | Application |
|------|-------------|
| 23% | Standard rate (most goods and services) |
| 19% | Reduced rate (food, pharmaceuticals, books, accommodation) |
| 5% | Super-reduced rate (some food items, social housing) |
| 0% | Exempt (intra-EU supply, exports) |

### Slovak corporate tax rates

| Bracket | Rate |
|---------|------|
| Up to 49,790 EUR | 15% |
| Above 49,790 EUR | 21% |

---

## 12. Background Jobs & Edge Functions

### 12.1 Supabase Edge Functions

| Function | Trigger | Purpose |
|----------|---------|---------|
| `poll-gmail` | Cron (15 min) | Fetch Gmail attachments, create documents, deduplicate |
| `process-ocr` | Async after upload | OCR via Google Vision, 3x retry with backoff |
| `send-overdue-alerts` | Daily cron (7am) | Mark invoices past due_date as overdue |
| `write-audit-log` | Client-side calls | Centralized audit log writer |

### 12.2 API-based cron endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/cron/recurring` | Generate invoices from recurring templates |
| `POST /api/queue/process` | Process generic job queue |

Both require `CRON_SECRET` / `QUEUE_PROCESS_SECRET` for authentication.

### 12.3 Job queue

The `job_queue` table supports async processing of:
- Recurring invoice generation
- ML categorization training
- Export file generation
- AI-powered analysis
- Health check validation

---

## 13. Security Model

### 13.1 Authentication

- Supabase Auth with email/password
- httpOnly JWT cookies (not accessible from JavaScript)
- Automatic token refresh
- CSRF protection on OAuth flows (nonce in cookie)

### 13.2 Encryption

- Gmail OAuth tokens encrypted with AES-256-GCM before storage (`lib/crypto.ts`)
- Encryption key stored in `ENCRYPTION_KEY` environment variable
- S3 presigned URLs expire after 15 min (upload) / 1 hour (download)

### 13.3 Input validation

- All API inputs validated with Zod schemas at the boundary
- All file uploads validated for type (PDF, JPEG, PNG, WebP, Excel) and size (20MB max)
- S3 filenames sanitized (non-alphanumeric characters replaced)

### 13.4 Tenant isolation

- RLS on all 34 data tables
- Every API route verifies org membership before processing
- `organization_id` extracted from authenticated session, never trusted from request
- Audit log is append-only (no UPDATE/DELETE policies)

### 13.5 Security headers

Applied via middleware:
- `Content-Security-Policy` (restricts inline scripts, allows Supabase/Google origins)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY`
- `Referrer-Policy: strict-origin-when-cross-origin`

---

## 14. Deployment

### 14.1 Prerequisites

- Supabase project (cloud)
- AWS S3 bucket with CORS configured for your domain
- Vercel account (or any Node.js hosting)
- DNS configured for your domain

### 14.2 Database

```bash
supabase link --project-ref <ref>
supabase db push
```

### 14.3 Application

Deploy to Vercel (recommended) or any platform supporting Next.js:

```bash
pnpm build
```

Set all environment variables from [Section 5](#5-environment-variables) in your hosting provider.

### 14.4 Edge Functions

```bash
supabase functions deploy poll-gmail
supabase functions deploy process-ocr
supabase functions deploy send-overdue-alerts
supabase functions deploy write-audit-log
```

### 14.5 Cron jobs

Set up external cron (e.g., Vercel Cron, Railway, or cron-job.org) to call:
- `POST /api/cron/recurring` — daily at midnight
- `POST /api/queue/process` — every 5 minutes

Include the respective secrets in the request headers.

---

## 15. Known Limitations & Roadmap

### Current limitations

- **No mobile app** — web only (responsive design)
- **No PSD2/Open Banking** — bank import is manual (CSV/MT940)
- **No Microsoft 365** — only Gmail integration
- **No Stripe billing** — subscription table exists but integration is scaffold only
- **Single currency** — EUR only (multi-currency planned)
- **No real-time collaboration** — no WebSocket/live updates between users
- **No payroll module** — payroll processing not yet implemented
- **No asset depreciation** — fixed asset tracking not yet implemented

### Planned for Phase 2

- PSD2 / Open Banking API for automatic bank sync
- Microsoft 365 email integration
- Mobile app (iOS/Android)
- Self-learning categorization (ML model training)
- Predictive transaction matching
- Multi-currency support
- Stripe billing integration
- Real-time collaboration (Supabase Realtime)
- Payroll module
- Fixed asset register and depreciation
- Direct filing to Slovak Financial Administration (eDane integration)
- CZ/EU market expansion

---

## Appendix: File Storage

### Upload flow

```
Browser → POST /api/storage/upload → presigned PUT URL → Browser → S3 directly
```

### Download flow

```
Browser → GET /api/storage/download?key=... → presigned GET URL → Browser → S3 directly
```

### S3 key format

```
{organizationId}/{year}/{month}/{uuid}/{sanitized_filename}
```

---

## Appendix: Document Status Lifecycle

```
New → Auto-processed → Awaiting Review → Approved → Archived
                     ↘ (OCR failed) → New + alert notification
```

## Appendix: Invoice Status Lifecycle

```
draft → sent → paid
           └→ overdue (auto, via cron)
           └→ cancelled
           └→ closed (by accountant)
```
