# VEXERA — Master Project Plan & Context Document
> Version 1.0 | March 2026 | Context file for Claude Code

---

## 1. WHAT IS VEXERA?

VEXERA is a **standalone cloud accounting platform** — a complete replacement for legacy Slovak accounting systems (Pohoda, Money S3, KROS, Omega). It combines full accounting, AI-powered automation, and a modern collaboration workspace in one cloud-native product.

**One-liner vision:** The modern cloud accounting platform that replaces legacy Slovak accounting software — complete accounting with AI automation.

**Product name in spec documents:** "Účtovný SaaS" / internal codename VEXERA.

---

## 2. CURRENT STATE OF THE CODEBASE

### Repository: `github.com/david-brezula/VEXERA`

**Phase 0 (Scaffold) — COMPLETE:**
- Authentication: login / register via Supabase Auth (email + password)
- Organization management + multi-tenant switching
- Database schema: 16 migrations in `supabase/migrations/`
- Row Level Security (RLS) policies on all tables
- File storage infrastructure (AWS S3, presigned URLs)
- Settings page scaffold + member management scaffold
- Seed data: Slovak chart of accounts (`supabase/seed.sql`)

**What does NOT exist yet (Phase 1 MVP):**
- Document upload flow (UI + backend logic)
- OCR integration (async worker + queue)
- Email integration (Gmail OAuth2, polling)
- Bank statement import (CSV/MT940)
- Payment reconciliation engine
- Categorization rules engine (IF-THEN)
- Accountant Inbox / work queue
- Entrepreneur dashboard (P&L, VAT, tax estimate)
- Accountant dashboard (productivity KPIs)
- Export to Pohoda/Money/KROS (CSV adapter)
- Notification system (in-app + email)
- Onboarding wizard (5-step)
- Audit log

### Tech Stack (current)
| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React 19) |
| Language | TypeScript 5 (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Supabase (PostgreSQL) |
| Auth | Supabase Auth |
| State | TanStack Query (React Query) |
| Forms | React Hook Form + Zod |
| File storage | AWS S3 (presigned URLs) |
| Monorepo | pnpm workspaces + Turborepo |

---

## 3. WHO ARE THE USERS

### ICP #1 — Accounting Firm (PRIMARY CUSTOMER)
- 3–25 employees, 30–200 active clients
- Uses Pohoda / Money S3 / KROS / Alfa+
- Chaotic processes: email, Excel, paper, WhatsApp
- Pain: team is overloaded, can't scale without hiring

### ICP #2 — Small Business Owner (SECONDARY, end user)
- s.r.o. or sole trader, 50k–1M € revenue, 1–20 people
- Has an external accountant
- Pain: forgets to send documents, doesn't understand reports, sees numbers too late

### Persona A — Martina (Accounting firm owner / Admin)
- Wants to handle 2× clients without 2× staff
- Trigger: capacity limits, paperless ambitions, errors from process chaos
- Success metrics: % auto-processed docs, clients per accountant, hours/month on manual tasks

### Persona B — Peter (Senior Accountant / Power User)
- Works with 20–40 clients daily
- Wants: system handles extraction, he only confirms exceptions
- Success metrics: documents/hour, % without manual correction

### Persona C — Jakub (Business owner / End User)
- No accounting knowledge, external accountant
- Wants: photo invoice → accountant has it; dashboard = instant view of P&L and tax estimate
- Success metrics: login frequency, missing documents trend

---

## 4. PRODUCT PRINCIPLES (NON-NEGOTIABLE)

1. **Automation-first** — every feature must have a time-saving hypothesis (minutes/accountant/month)
2. **Accountant-in-control** — AI always only suggests; accountant has final say
3. **Shared workspace** — communication and documents in one system, minimum shadow channels
4. **Exportability** — clean exports to Pohoda/Money/KROS from day 1
5. **Legislation-respecting** — supports Slovak VAT and income tax, not a full legislative monster

---

## 5. BUILD ORDER (PHASE 1 MVP — STRICT SEQUENCE)

Each step must pass its gate test before proceeding to the next. Do NOT skip to frontend without working backend.

| # | What to build | Key files/modules | Gate test |
|---|---|---|---|
| 1 | ✅ Project scaffold + DB schema | migrations, docker-compose | DB up and running |
| 2 | ✅ Auth & Tenant Service | auth routes, JWT, RBAC | Login/register works |
| 3 | ✅ Company & User management | company CRUD, invite flow | Tenant can create company and invite users |
| **4** | **Document Service — core** | document model, CRUD, status state machine | CRUD + state transitions work |
| **5** | **File upload + OCR worker** | S3 upload middleware, OCR async worker, queue | Upload PDF → OCR job → extracted fields saved |
| **6** | **Email Integration (Gmail OAuth2)** | Gmail OAuth, email poller, attachment extractor | New email with attachment → document created |
| **7** | **Rules Engine** | rule model, IF-THEN engine, rule applier | Create rule → applied on document events |
| **8** | **Bank Import + Reconciliation** | CSV/MT940 parser, bank transaction service, reconciliation engine | Import statement → auto-match VS+amount |
| **9** | **Export Service** | Pohoda/Money CSV adapter (pluggable), async job | Generate downloadable CSV export |
| **10** | **Audit Log Service** | audit interceptor, audit service | Every key action logged |
| **11** | **Notification Service** | in-app + email notifications, event templates | Comment → notification to other party |
| **12** | **Analytics Service (basic)** | dashboard controller, data aggregation | Dashboard shows real DB data |
| **13** | **Frontend — Shell + Auth** | app shell, login, tenant selector, RBAC routes | Login → correct dashboard by role |
| **14** | **Frontend — Documents module** | document list, detail, upload, inbox, batch actions | Full document workflow in UI |
| **15** | **Frontend — Bank module** | bank statement list, import wizard, reconciliation UI | Import + matching in UI |
| **16** | **Frontend — Dashboards** | entrepreneur dashboard, accountant dashboard, task panel | Both dashboards show real data |
| **17** | **Frontend — Onboarding wizard** | 5-step wizard, progress bar, skip logic, completion tracking | New accounting firm completes full onboarding |
| **18** | **E2E tests + security audit** | Playwright tests, tenant isolation tests | No cross-tenant leaks. Activation flows work. |

---

## 6. FULL MVP FEATURE LIST (FR1–FR20)

| ID | Feature | Description |
|---|---|---|
| FR1 | Document list | Filter by type, period, status, partner, amount |
| FR2 | Document detail + OCR | PDF preview + extracted fields (supplier, number, dates, amounts, VAT). Editable. |
| FR3 | Document status model | New → Auto-processed → Awaiting review → Approved → Awaiting client → Archived |
| FR4 | Comments on document | Comments with name/time, notifications, conversation history |
| FR5 | Manual upload | Drag&drop or file picker for PDF/JPG/PNG. Progress states. |
| FR6 | External OCR processing | Async OCR API call. Result → extracted fields. Error → status New + alert. |
| FR7 | Gmail OAuth integration | Connect Gmail via OAuth2. Secure token storage. |
| FR8 | Email attachment download | Poll every 15 min. Detect invoices (PDF/image). Reference to source email. |
| FR9 | Bank statement import | CSV, MT940 formats. Preview before import. |
| FR10 | Bank transactions view | Table: date, amount, currency, VS, description, partner account, match status |
| FR11 | Auto-matching (VS + amount) | On import, scan unmatched transactions. VS+amount match → invoice marked paid |
| FR12 | Manual categorization rules | IF (supplier=X OR text contains Y) THEN category=Z. Logs applied rule. |
| FR13 | Entrepreneur dashboard (basic) | Monthly/yearly revenue, expenses, profit summary. VAT in/out. Basic tax estimate. |
| FR14 | Accountant dashboard (basic) | Client list with unprocessed + auto-processed doc counts. Click-through to firm detail. |
| FR15 | Export accounting entries CSV | Generate CSV for selected period. Pohoda/Money compatible. Audit logged. |
| FR16 | Audit log (basic) | Log: login, create/edit document, status change, rule, bank import, export |
| FR17 | Multi-tenant foundation | Accounting firm = tenant. Multiple client firms per tenant. Data isolation. |
| FR18 | User & role management | Roles: Admin, Senior, Junior, Entrepreneur. RBAC on all operations. |
| FR19 | Onboarding wizard | 5-step wizard: firm details → team → first client → upload docs → import bank |
| FR20 | Accountant Inbox | Work queue: new + auto-processed docs waiting for review. Bulk actions. |

---

## 7. KEY TECHNICAL REQUIREMENTS

### Multi-tenancy (ABSOLUTELY NON-NEGOTIABLE)
- Every DB model MUST have `tenant_id` with index
- Global ORM middleware/Supabase RLS automatically adds `WHERE tenant_id = :current_tenant` to every query
- `tenant_id` ALWAYS comes from JWT token — NEVER from request body or URL parameter alone
- Unit test: user from tenant A cannot see documents of tenant B — run on every CI build
- Zero tolerance for cross-tenant data leaks

### Async OCR processing
- File upload NEVER blocks — immediately return `202 Accepted` + `job_id`
- OCR worker runs async in queue — updates Document status + emits WebSocket/SSE event
- Retry logic: 3 attempts with exponential backoff
- Timeout: 60 seconds — after timeout status = New + alert

### Gmail OAuth
- Refresh tokens stored encrypted (AES-256) in DB — NOT plaintext
- Poll every 15 minutes via cron/scheduled task
- Duplicate detection: store `gmail_message_id`, check before creating document
- Graceful degradation: if Gmail API fails, log error and continue — must not crash app

### Export adapters (pluggable pattern)
- `ExportAdapter` interface with `generate(period, company)` and `getFormat()` methods
- `PohoadaAdapter` implements `ExportAdapter`
- Each export is async; result file goes to S3; link sent via notification

### Security
- HTTPS everywhere (TLS 1.2+)
- Passwords: bcrypt/argon2, no plaintext
- JWT: 15 min access token + 7 day refresh token
- Protection: SQL injection, XSS, CSRF, rate limiting on all endpoints
- Encryption at-rest (DB + object storage) and in-transit

### Performance targets
- API response: < 1 second for typical operations
- OCR processing: < 30 seconds for 1-page document
- Upload: max 20 MB per file, max 50 files per batch
- Availability: 99.5% monthly

---

## 8. DATA MODEL (KEY ENTITIES)

| Entity | Key fields | Relationships |
|---|---|---|
| `Tenant` | id, name, license, billing_info, country, settings | Has many Companies, Users |
| `Company` | id, tenant_id, name, ico, dic, ic_dph, vat_mode, currency, period | Belongs to Tenant |
| `User` | id, tenant_id, email, password_hash, role, companies[] | Belongs to Tenant |
| `Document` | id, company_id, tenant_id, type, status, file_path, extracted_data, category, vat_mode, amounts | Belongs to Company |
| `BankTransaction` | id, company_id, tenant_id, date, amount, currency, vs, description, partner_account, match_status | Belongs to Company |
| `Rule` | id, tenant_id, company_id, conditions[], actions[], priority, enabled | Belongs to Tenant/Company |
| `Invoice` | id, company_id, customer_id, items[], amounts, due_date, status, pdf_path | Belongs to Company |
| `ExportJob` | id, company_id, period, format, status, file_path, created_by | Belongs to Company |
| `AuditEvent` | id, tenant_id, user_id, action, entity_type, entity_id, diff, ip, timestamp | Belongs to Tenant |
| `Notification` | id, user_id, type, content, read, created_at, action_url | Belongs to User |

---

## 9. API CONTRACT SUMMARY

### Auth & Tenant
- `POST /auth/register` — new tenant registration
- `POST /auth/login` — returns JWT with tenant_id + role
- `POST /auth/refresh` — refresh JWT
- `GET /companies` — list companies for current tenant
- `POST /companies` — create new client firm
- `POST /users/invite` — invite user by email

### Documents
- `GET /companies/{id}/documents` — list with filters
- `GET /documents/{id}` — detail including OCR data + status history
- `POST /documents/upload` — upload 1-N files, triggers OCR job
- `PATCH /documents/{id}` — edit fields
- `PATCH /documents/{id}/status` — change status
- `POST /documents/{id}/comments` — add comment
- `POST /documents/batch-approve` — bulk approve

### Bank & Reconciliation
- `POST /companies/{id}/bank-statements/import` — upload CSV/MT940
- `GET /companies/{id}/bank-transactions` — list with filters
- `POST /companies/{id}/reconciliation/run` — trigger auto-matching
- `PATCH /bank-transactions/{id}/match` — manual match

### Rules & Export
- `GET/POST /companies/{id}/rules` — list/create rules
- `PUT/DELETE /rules/{id}` — update/deactivate rule
- `POST /companies/{id}/exports` — trigger export (async)
- `GET /companies/{id}/exports` — list exports with file links
- `GET /audit-log` — filterable audit log (admin only)

---

## 10. ONBOARDING FLOWS

### Martina (Accounting firm — 5-step wizard)
1. Register firm (name, email, password, country)
2. Firm details (ICO, DIC, IC_DPH, contact person)
3. Add team (name, email, role — pre-filled: add yourself as Senior)
4. First client (company name, ICO, type, VAT payer yes/no)
5. First documents + bank (CTA: add docs for firm X)

**Completion condition:** 1 client created + 1 accountant added + ≥3 documents uploaded → persistent banner until done

### Peter (Senior Accountant — welcome + tour)
- Welcome screen: "Start processing documents" OR "Watch 3-step tutorial"
- Tooltip walkthrough: Inbox → Document Detail → Bank
- First AHA moment: batch-approve 10 docs → banner "You just approved X documents without manual data entry — saved Y minutes"

### Jakub (Entrepreneur — super simple)
- Welcome: "This is your new place for documents and company overview"
- 2 main CTAs: Upload Documents / View Company Status
- After upload: "Documents sent to accountant" → CTA: View Dashboard
- First AHA moment: dashboard with numbers + "These figures come from the documents you just uploaded"

---

## 11. SUCCESS METRICS

### North Star
**Auto-processing rate** = automatically processed documents / total documents in system
- MVP target: ≥ 40%
- Phase 2 target: ≥ 70%
- Long-term: ≥ 80–90%

### Supporting Metrics
| Metric | MVP target | Phase 2 target |
|---|---|---|
| Auto-processing rate | ≥ 40% | ≥ 70% |
| Time per document | Measure baseline | -30% vs baseline |
| Dashboard adoption (entrepreneurs) | ≥ 30% log in 1×/month | ≥ 50% |
| Activation rate (accountants, 30 days) | ≥ 40% | ≥ 60% |
| Activation rate (entrepreneurs, 7 days) | ≥ 40% | ≥ 60% |
| NPS (accountants, 3 months) | ≥ 30 | ≥ 50 |
| Retention (accounting firms, 6 months) | ≥ 70% | ≥ 85% |

---

## 12. ROADMAP

### Phase 1 — MVP (0–9 months) ← WE ARE HERE
Core automation: document processing, OCR, email integration, bank import/matching, basic dashboards, export to Pohoda/Money, onboarding wizard.

### Phase 2 — AI & Automation (9–18 months)
Self-learning categorization rules (ML), health checks on documents, cashflow projections, real-time tax estimate, KPI dashboard for accounting firms, invoicing module (issue invoices, PDF, email), predictive matching.

### Phase 3 — Platform & Scale (18+ months)
PSD2/Open Banking API, Microsoft 365 email, electronic document archive, advanced legislative module, open API for third parties, white-label portals for accounting firms, mobile app (iOS/Android), expansion to other markets.

---

## 13. ENVIRONMENT VARIABLES (REQUIRED)

```env
# Database
DATABASE_URL=postgresql://...  # or Supabase connection string

# Auth
JWT_SECRET=<random-256-bit>
JWT_REFRESH_SECRET=<random-256-bit>

# Queue
REDIS_URL=redis://...

# Storage
S3_BUCKET=...
S3_REGION=...
S3_ACCESS_KEY=...
S3_SECRET_KEY=...

# OCR
OCR_PROVIDER=google|aws|azure
GOOGLE_VISION_API_KEY=...

# Email integration
GMAIL_CLIENT_ID=...
GMAIL_CLIENT_SECRET=...
SMTP_HOST=...
SMTP_USER=...
SMTP_PASS=...

# Security
ENCRYPTION_KEY=<AES-256-key-for-oauth-tokens>

# App
FRONTEND_URL=https://app.vexera.sk
```

---

## 14. RISKS & MITIGATIONS

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Poor OCR quality on Slovak documents | Medium | High | Pilot with real documents before GA. Fallback to manual entry. Test 3 OCR providers. |
| Accountant resistance to change | High | High | Close collaboration with pilot firms. Onboarding assistance. Measure time-to-activation. |
| Pohoda/Money export mapping complexity | Medium | Medium | Consult format before development. Test import on real Pohoda instance. |
| Gmail OAuth token expiry/revocation | Low | Medium | Monitor token health. Alert on failure. Simple re-connect UI for admin. |
| Cross-tenant data leak | Low | Critical | Mandatory tenant_id on all queries. Automated security tests in CI. Penetration test before GA. |
| OCR queue scaling | Low (MVP) | Medium | Horizontal scaling of OCR workers. Queue length monitoring with alerts. |

---

## 15. LEAN UX HYPOTHESES (TO VALIDATE IN MVP)

- **H1:** If an accountant batch-approves ≥10 auto-processed documents in week 1, they will remain an active user
- **H2:** If an entrepreneur uploads documents and sees the dashboard within 3 days, they will perceive the product as useful
- **H3:** The "What does my accountant need from me?" task panel will reduce missing documents by ≥30%
- **H4:** A shorter 5-step onboarding wizard increases completion rate by ≥20% vs a longer one

---

## 16. KEY ANALYTICAL EVENTS TO TRACK

| Category | Event | Persona |
|---|---|---|
| Setup | tenant_created, client_created, user_invited, user_first_login | Martina |
| Documents | documents_uploaded_first_time, bank_statement_imported_first_time | Peter/Jakub |
| Workflow | documents_batch_approved, export_generated | Peter |
| Entrepreneur | owner_view_dashboard_first_time, owner_todo_resolved_first_time | Jakub |

---

*This document synthesizes the Product Vision, ICP & Personas, Architecture Design, UX/Onboarding Specification, and Master Build Specification (Accounting_SaaS.pdf). It is intended as a persistent context file for Claude Code sessions working on the VEXERA codebase.*
