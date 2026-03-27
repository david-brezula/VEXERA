# VEXERA — Project Overview
> Persistent context file for Claude Code sessions. Keep this file open as a reference.

---

## 1. WHAT IS VEXERA?

VEXERA is a **standalone multi-tenant cloud accounting platform for the Slovak market** — a complete replacement for legacy desktop accounting software (Pohoda, Money S3, KROS, Omega). It combines full accounting functionality with AI-powered automation in a modern cloud-native architecture.

**One-liner:** The modern cloud accounting platform that replaces legacy Slovak accounting software.

**Repository:** `github.com/david-brezula/VEXERA`
**Branch:** `feat/role-based-onboarding`

---

## 2. BUILD STATUS

### Phase 0 — COMPLETE (scaffold)
- Supabase Auth (email + password), httpOnly JWT cookies
- Multi-tenant organization switching (`active_organization_id` cookie)
- 26 DB migrations (see Section 7)
- Row Level Security (RLS) on all tables
- AWS S3 file storage (presigned upload/download URLs)
- Settings page, member management, invite flow
- Seed data: Slovak chart of accounts

### Phase 1 MVP — COMPLETE (all 3 sprints)

**Sprint 1 — Backend core:**
- `storage.service.ts` — S3 presigned upload/download
- `document.service.ts` — Document CRUD (S3 + DB + audit)
- `ocr.service.ts` — OCR extraction (Google Vision)
- `bank-import.service.ts` — CSV + MT940 parser
- `reconciliation.service.ts` — VS + amount auto-matching
- `rules-engine.service.ts` — IF-THEN rule evaluator
- `audit.server.ts` — Non-fatal audit log writer
- `gmail.service.ts` — Gmail OAuth2 + message/attachment fetch
- `notification.service.ts` — create, list, mark-read, count-unread
- `duplicate-detection.service.ts` — Email duplicate detection
- API routes: documents, bank/accounts, bank/reconcile, bank/transactions, rules, rules/apply, notifications, email/connect, email/callback
- Migrations 17–22: bank_accounts, bank_transactions, rules, export_jobs, email_connections, notifications

**Sprint 2 — Rules, export, notifications + frontend core:**
- `export/` — ExportAdapter interface + PohoadaAdapter + MoneyS3Adapter + GenericCsvAdapter
- API routes: export, audit, vat, cashflow, accountant/dashboard, documents/[id]/status, comments, batch, ocr, duplicates, process
- Frontend: Bank page, Rules page (full CRUD with IF-THEN builder), Export page
- Migrations 23–24: document_status, document_corrections

**Sprint 3 — Dashboards, onboarding, E2E:**
- Frontend pages: Document detail (`/documents/[id]`), Inbox (`/inbox`), Accountant dashboard (`/accountant`), Export (`/export`), Onboarding wizard (`/onboarding`)
- Components: `financial-overview.tsx`, `cashflow-widget.tsx`, `vat-widget.tsx`, `accountant-dashboard.tsx`, `inbox-client.tsx`, `onboarding-wizard.tsx`, `notifications-bell.tsx`, `email-connection.tsx`
- Data layers: `financial-stats.ts`, `cashflow.ts`, `vat.ts`, `accountant-dashboard.ts`, `inbox.ts`
- Services: `cashflow.service.ts`, `vat.service.ts`, `categorization.service.ts`, `email.service.ts`
- Supabase Edge Function: `supabase/functions/poll-gmail/` (Gmail poller, runs every 15 min)
- Migrations 25–26: cashflow_and_recurring, vat_returns
- Playwright E2E tests: `apps/web/e2e/`, `apps/web/playwright.config.ts`
- Security tests: `tests/security/tenant-isolation.spec.ts`

---

## 3. TECH STACK

| Layer | Technology |
|---|---|
| Framework | Next.js (App Router, React 19) |
| Language | TypeScript 5 strict |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth (httpOnly cookies) |
| State | TanStack Query (React Query) |
| Forms | React Hook Form + Zod v4 |
| File storage | AWS S3 (presigned URLs) |
| Monorepo | pnpm workspaces + Turborepo |
| Testing | Playwright (E2E) |

---

## 4. MONOREPO STRUCTURE

```
/
├── apps/
│   └── web/                      # Main Next.js app (@vexera/web)
│       └── src/
│           ├── app/
│           │   ├── (auth)/        # /login, /register (no sidebar)
│           │   ├── (dashboard)/   # All protected pages (sidebar + header)
│           │   │   ├── page.tsx           → /  (entrepreneur dashboard)
│           │   │   ├── invoices/          → /invoices
│           │   │   ├── documents/         → /documents
│           │   │   ├── documents/[id]/    → /documents/:id (detail)
│           │   │   ├── bank/              → /bank
│           │   │   ├── rules/             → /rules
│           │   │   ├── export/            → /export
│           │   │   ├── inbox/             → /inbox (accountant work queue)
│           │   │   ├── accountant/        → /accountant (accountant dashboard)
│           │   │   ├── onboarding/        → /onboarding (5-step wizard)
│           │   │   ├── settings/          → /settings
│           │   │   └── ledger/            → /ledger
│           │   └── api/                   # API routes
│           │       ├── documents/         # GET list, POST upload, batch, status, comments, OCR
│           │       ├── bank/              # accounts, transactions, import, reconcile
│           │       ├── rules/             # CRUD + apply
│           │       ├── export/            # async export jobs
│           │       ├── audit/             # audit log
│           │       ├── notifications/     # GET + PATCH mark-read
│           │       ├── email/             # connect + callback (Gmail OAuth)
│           │       ├── cashflow/          # cashflow data
│           │       ├── vat/               # VAT return data
│           │       ├── accountant/        # accountant dashboard data
│           │       └── storage/           # presigned upload/download
│           ├── components/
│           │   ├── ui/            # shadcn/ui base (do not edit)
│           │   ├── layout/        # sidebar, header, org-switcher, notifications-bell
│           │   ├── invoices/      # invoice-table-client, invoice-form, filters, badges
│           │   ├── documents/     # documents-table-client, document-detail-client, uploader, badges
│           │   ├── bank/          # bank-page-client, transactions-table, import-wizard, reconcile-panel
│           │   ├── rules/         # rules-page-client, rules-table, rule-form-dialog
│           │   ├── export/        # export-page-client
│           │   ├── inbox/         # inbox-client
│           │   ├── onboarding/    # onboarding-wizard
│           │   ├── settings/      # email-connection
│           │   └── dashboard/     # financial-overview, cashflow-widget, vat-widget, accountant-dashboard
│           ├── hooks/             # use-invoices, use-documents, use-bank, use-rules, use-notifications
│           ├── lib/
│           │   ├── supabase/      # client.ts, server.ts, middleware.ts
│           │   ├── s3/            # S3 client + key generation
│           │   ├── validations/   # Zod schemas (auth, invoice, document, rule, organization)
│           │   ├── services/      # All business logic services (server-side)
│           │   ├── data/          # Server-side data fetching functions
│           │   ├── actions/       # Server Actions (invoices, documents)
│           │   ├── query-keys.ts  # TanStack Query key factory
│           │   └── env.ts         # Validated env vars
│           ├── providers/         # SupabaseProvider, QueryProvider, OrganizationProvider
│           └── middleware.ts      # Route protection (auth redirects)
├── packages/
│   ├── types/                    # @vexera/types (shared TS types + DB types)
│   └── utils/                    # @vexera/utils (formatEur, VAT math)
├── supabase/
│   ├── migrations/               # 26 SQL migration files
│   └── functions/
│       └── poll-gmail/           # Edge Function: polls Gmail every 15 min
├── tests/
│   └── security/                 # tenant-isolation.spec.ts
├── docs/
│   ├── ARCHITECTURE.md
│   ├── DATABASE.md
│   ├── DEVELOPMENT.md
│   └── AUTH_FLOW.md
└── apps/web/e2e/                 # Playwright E2E tests
```

---

## 5. ARCHITECTURE

### Multi-tenancy
- Every DB table has `organization_id` with index
- RLS policies enforce tenant isolation at the DB level (last line of defense)
- `tenant_id` always comes from the authenticated JWT — never from request body
- Helper functions: `get_user_organization_ids()`, `get_accountant_organization_ids()`, `get_accessible_organization_ids()`

### Provider Stack (React)
```
RootLayout
  └── SupabaseProvider       (auth session, Supabase browser client)
        └── QueryProvider    (TanStack Query cache — 60s fresh, no refetch-on-focus)
              └── OrganizationProvider  (active org from cookie, org switching)
                    └── Pages
```

### Data Fetching Pattern
- **Server Components** → `lib/data/*.ts` functions (direct DB via Supabase server client)
- **Client Components** → TanStack Query hooks (`hooks/use-*.ts`) via Supabase browser client
- **Write operations** → Next.js Server Actions (`lib/actions/*.ts`) or API routes

### File Storage
```
Upload: Browser → POST /api/storage/upload → presigned PUT URL → Browser → S3 directly
Download: Browser → GET /api/storage/download?key=... → presigned GET URL → Browser → S3 directly
S3 key format: {organizationId}/{year}/{month}/{uuid}/{filename}
```

### Async Operations
- File upload returns `202 Accepted` + `job_id` immediately — OCR runs async
- Export generation is async — result goes to S3, link sent via notification
- Gmail polling: Supabase Edge Function (`poll-gmail`) runs every 15 minutes

---

## 6. DATABASE — 26 MIGRATIONS

| # | File | What it does |
|---|---|---|
| 001 | extensions_helpers | uuid-ossp, pgcrypto, updated_at trigger |
| 002 | profiles | profiles table + handle_new_user trigger |
| 003 | organizations | organizations table |
| 004 | organization_members | members + roles |
| 005 | invitations | invite by email (token-based) |
| 006 | accountant_clients | external accountant access + JSONB permissions |
| 007 | chart_of_accounts | Slovak účtovná osnova (system + org-specific) |
| 008 | invoices | issued + received invoices, status lifecycle |
| 009 | invoice_items | line items, VAT per line |
| 010 | documents | document metadata (file in S3), OCR status |
| 011 | ledger_entries | double-entry accounting records |
| 012 | audit_logs | immutable action log (INSERT only, no UPDATE/DELETE) |
| 013 | subscriptions | Stripe subscription data (scaffold) |
| 014 | rls_policies | All RLS policies + helper functions |
| 015 | seed_chart_of_accounts | Slovak chart of accounts system data |
| 016 | fix_profiles_rls | INSERT policy on profiles (legacy users) |
| 017 | bank_accounts | Bank account records per org |
| 018 | bank_transactions | Imported transactions (CSV/MT940) |
| 019 | rules | IF-THEN categorization rules |
| 020 | export_jobs | Async export job tracking |
| 021 | email_connections | Gmail OAuth tokens (encrypted) + email_imports |
| 022 | notifications | In-app notification feed |
| 023 | document_status | Extended document status state machine |
| 024 | document_corrections | OCR field correction history |
| 025 | cashflow_and_recurring | Cashflow projections + recurring transactions |
| 026 | vat_returns | VAT return periods + line items |

### Key RLS Policy Matrix

| Table | SELECT | INSERT | UPDATE | DELETE |
|---|---|---|---|---|
| profiles | own row + org members | own row | own row | — |
| organizations | member/accountant orgs | any auth user | member orgs | — |
| invoices | accessible orgs | member orgs | member orgs (non-closed) | — |
| documents | accessible orgs | member orgs | member orgs | — |
| audit_logs | accessible orgs | any auth user | **never** | **never** |

---

## 7. SERVICES (all in `apps/web/src/lib/services/`)

| Service | Purpose |
|---|---|
| `storage.service.ts` | S3 presigned upload/download URLs |
| `document.service.ts` | Document CRUD (S3 + DB + audit log) |
| `ocr.service.ts` | OCR field extraction (Google Vision) |
| `bank-import.service.ts` | Parse CSV + MT940 bank statements |
| `reconciliation.service.ts` | Auto-match transactions by VS + amount |
| `rules-engine.service.ts` | Pure IF-THEN rule evaluator |
| `audit.server.ts` | Non-fatal audit log writer |
| `gmail.service.ts` | Gmail OAuth2, message/attachment fetch |
| `notification.service.ts` | Create, list, mark-read, count-unread |
| `duplicate-detection.service.ts` | Detect duplicate email imports by gmail_message_id |
| `categorization.service.ts` | Apply categorization rules to documents |
| `cashflow.service.ts` | Cashflow projection calculations |
| `vat.service.ts` | VAT return period calculations |
| `email.service.ts` | Outbound email (SMTP) notifications |
| `export/export.adapter.ts` | ExportAdapter interface |
| `export/pohoda.adapter.ts` | Pohoda-compatible CSV export |
| `export/money-s3.adapter.ts` | Money S3-compatible CSV export |
| `export/generic-csv.adapter.ts` | Generic CSV export |

---

## 8. API ROUTES

### Documents
| Method | Route | Purpose |
|---|---|---|
| GET/POST | `/api/documents` | List documents / Upload (returns 202 + job_id) |
| PATCH | `/api/documents/[id]/status` | Change document status |
| POST | `/api/documents/[id]/comments` | Add comment |
| POST | `/api/documents/[id]/ocr` | Trigger OCR manually |
| GET | `/api/documents/[id]/duplicates` | Check for duplicates |
| POST | `/api/documents/batch` | Bulk approve/reject |
| POST | `/api/documents/process` | Process document through rules engine |

### Bank
| Method | Route | Purpose |
|---|---|---|
| GET/POST/PATCH/DELETE | `/api/bank/accounts` | Bank account CRUD |
| POST | `/api/bank/import` | Import CSV/MT940 statement |
| GET/POST | `/api/bank/transactions` | List / manual transaction |
| PATCH | `/api/bank/transactions/[id]/match` | Manual reconciliation |
| GET/POST | `/api/bank/reconcile` | Get suggestions / run auto-reconcile |

### Rules & Export
| Method | Route | Purpose |
|---|---|---|
| GET/POST | `/api/rules` | List / create rules |
| GET/PATCH/DELETE | `/api/rules/[id]` | Rule detail / update / delete |
| POST | `/api/rules/apply` | Batch apply rules to entities |
| GET/POST | `/api/export` | List exports / trigger async export |

### Other
| Method | Route | Purpose |
|---|---|---|
| GET/PATCH | `/api/notifications` | List / mark-read |
| GET | `/api/audit` | Filterable audit log (admin only) |
| GET | `/api/cashflow` | Cashflow data |
| GET | `/api/vat` | VAT return data |
| GET | `/api/accountant/dashboard` | Accountant productivity metrics |
| GET/POST | `/api/email/connect` | Start Gmail OAuth flow |
| GET | `/api/email/callback` | Gmail OAuth callback |

---

## 9. FRONTEND PAGES

| URL | Page | Key Components |
|---|---|---|
| `/` | Entrepreneur dashboard | `financial-overview`, `cashflow-widget`, `vat-widget` |
| `/invoices` | Invoice list | `invoice-table-client`, `invoice-filters` |
| `/invoices/new` | New invoice | `invoice-form`, `invoice-items-editor` |
| `/invoices/[id]` | Invoice detail | `invoice-actions`, `invoice-documents-tab` |
| `/documents` | Document list | `documents-table-client`, `document-uploader` |
| `/documents/[id]` | Document detail + OCR | `document-detail-client`, `document-status-badge` |
| `/bank` | Bank transactions | `bank-page-client`, `bank-import-wizard`, `bank-transactions-table`, `reconcile-suggestions-panel` |
| `/rules` | Categorization rules | `rules-page-client`, `rules-table`, `rule-form-dialog` |
| `/export` | Export to Pohoda/Money | `export-page-client` |
| `/inbox` | Accountant work queue | `inbox-client` |
| `/accountant` | Accountant dashboard | `accountant-dashboard` |
| `/onboarding` | 5-step setup wizard | `onboarding-wizard` |
| `/settings` | Org settings | `email-connection` (Gmail OAuth) |
| `/ledger` | Ledger entries | — |

---

## 10. KEY IMPLEMENTATION RULES

1. **tenant_id is sacred** — every DB query filtered by `organization_id` from JWT, never from request body. RLS is the last-line defense.

2. **No sync heavy operations** — OCR, email polling, bank import, export = async. Return `202 Accepted` + `job_id` immediately.

3. **Pluggable export adapters** — `ExportAdapter` interface. Never inline format logic. `PohoadaAdapter` + `MoneyS3Adapter` + `GenericCsvAdapter` all implement it.

4. **Type everything** — all new types go in `packages/types/src/`. Import from `@vexera/types`. No `any`.

5. **Zod on all API inputs** — validate with Zod at the API boundary. See existing schemas in `lib/validations/`.

6. **Audit log every key action** — use `auditLog.record()` for: document create/edit/status-change, bank import, export generated, rule created/modified.

7. **Test tenant isolation** — `tests/security/tenant-isolation.spec.ts` must pass on every commit.

8. **Gmail tokens encrypted** — store OAuth refresh tokens AES-256 encrypted, never plaintext.

---

## 11. KNOWN QUIRKS & GOTCHAS

### TypeScript
- `packages/types/src/database.types.ts` contains placeholder types with `Relationships: []`
  - Supabase join queries (`select("*, invoice_items(*)")`) return `never`
  - Fix: explicit return type + `as unknown as T` cast
  - Real fix: run `pnpm db:generate-types` against live Supabase project
- `@hookform/resolvers` v5 + Zod v4 + `useForm<T>` → use `zodResolver(schema) as unknown as Resolver<T>`
- Zod v4: use `error:` option (not `invalid_type_error`)
- `react-day-picker` v9: use `Chevron` with `orientation` prop (no `IconLeft`/`IconRight`)

### Supabase / RLS
- Never use `.select()` on an INSERT when the SELECT policy requires membership that doesn't exist yet
  - Fix: generate UUID client-side with `crypto.randomUUID()`, skip the RETURNING clause
- 403 on Supabase query = RLS blocking. Check user is logged in, user belongs to org, policy is correct.

### Development
- Always run pnpm from **monorepo root** with `--filter @vexera/web` (not from `apps/web`)
- pnpm binary: `C:/Users/ASMAEL/AppData/Roaming/npm/pnpm.cmd`
- Use `pnpm type-check` instead of `pnpm build` during development (build bakes env vars)
- After schema changes: `supabase gen types typescript --project-id <ref> > packages/types/src/database.types.ts`

---

## 12. DEVELOPMENT COMMANDS

```bash
# From monorepo root
pnpm dev                                  # Start dev server (Turbopack)
pnpm type-check                           # TypeScript check (preferred over build)
pnpm lint                                 # ESLint across all packages
pnpm --filter @vexera/web <command>       # Run command for web app only

# Database
supabase db push                          # Apply unapplied migrations
supabase gen types typescript --project-id <ref> > packages/types/src/database.types.ts

# Clean cache (if app behaves strangely after env changes)
rm -rf apps/web/.next && pnpm dev
```

---

## 13. USERS & ROLES

### Personas
- **Martina** (Admin / Accounting firm owner) — manages multiple client orgs, wants capacity without headcount
- **Peter** (Senior Accountant) — processes 20–40 clients/day, wants system to handle extraction
- **Jakub** (Entrepreneur / Business owner) — no accounting knowledge, wants instant P&L and tax estimate

### Roles
| Role | Access |
|---|---|
| `owner` | Full control of org (created it) |
| `admin` | Manage members and settings |
| `member` | Work with data, no settings |
| `accountant` | External via `accountant_clients` table, granular JSONB permissions |

---

## 14. ENVIRONMENT VARIABLES

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # Server-side only, never in browser

# AWS S3
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=
S3_BUCKET_NAME=

# Gmail OAuth
GMAIL_CLIENT_ID=
GMAIL_CLIENT_SECRET=
GMAIL_REDIRECT_URI=

# OCR
GOOGLE_VISION_API_KEY=              # or AWS_TEXTRACT / AZURE_FORM_RECOGNIZER

# Email (outbound)
SMTP_HOST=
SMTP_USER=
SMTP_PASS=

# Security
ENCRYPTION_KEY=                     # AES-256 key for OAuth token encryption

# App
NEXT_PUBLIC_APP_URL=https://app.vexera.sk
```

---

## 15. SHARED PACKAGES

### `@vexera/types`
- Auto-generated Supabase DB types (`database.types.ts`)
- Domain types: `InvoiceStatus`, `OrganizationRole`, `VatRate`, `DocumentStatus`, etc.

```typescript
import type { InvoiceStatus, OrganizationRole } from "@vexera/types"
import type { Database } from "@vexera/types"
type Invoice = Database["public"]["Tables"]["invoices"]["Row"]
```

### `@vexera/utils`
- `formatEur(amount)` → `"1 234,56 €"` (Slovak locale)
- `calculateVatAmount(net, rate)` → VAT from net
- `calculateGrossAmount(net, rate)` → net + VAT
- `calculateNetFromGross(gross, rate)` → reverse VAT

### Slovak VAT Rates
| Rate | Used for |
|---|---|
| 20% | Standard goods and services |
| 10% | Food, pharmaceuticals, books |
| 5% | Some food items, social housing |
| 0% | Intra-EU supply, exports |

---

## 16. DOCUMENT STATUS STATE MACHINE

```
New → Auto-processed → Awaiting Review → Approved → Awaiting Client → Archived
                    ↘ (OCR failed) → New + alert
```

---

## 17. INVOICE STATUS LIFECYCLE

```
draft → sent → paid
           └→ overdue
           └→ cancelled
           └→ closed (by accountant)
```

---

## 18. NEXT PHASE (Phase 2 — 9–18 months)

- Self-learning categorization rules (ML)
- Cashflow projections
- Real-time tax estimate
- KPI dashboard for accounting firms
- Invoicing module (issue invoices, PDF, send by email)
- Predictive transaction matching
- PSD2 / Open Banking API
- Microsoft 365 email integration
- Mobile app (iOS/Android)
