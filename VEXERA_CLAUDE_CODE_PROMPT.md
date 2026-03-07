# Claude Code — VEXERA Agent Team Prompt

## CONTEXT

You are working on **VEXERA** — a multi-tenant accounting SaaS product for the Slovak market. Read `VEXERA_PROJECT_PLAN.md` (in this repository) for the full product context, architecture decisions, and build order before doing anything else.

**Repository:** `github.com/david-brezula/VEXERA`

**Current state:** Phase 0 (Scaffold) is complete. Authentication, multi-tenant organization switching, database schema (16 migrations), RLS policies, and S3 file storage infrastructure all exist. The app starts and auth works.

**What is NOT built yet:** Document upload flow, OCR integration, email integration (Gmail), bank statement import, payment reconciliation, rules engine, dashboards, notifications, onboarding wizard, export to Pohoda/Money.

---

## YOUR TASK

Analyze the current codebase and produce a **detailed, phased execution plan** for completing Phase 1 (MVP) using a **multi-agent team approach** in Claude Code.

### Step 1 — Codebase audit

Read and map the current state:
- `apps/web/src/` — what pages, components, and API routes already exist
- `supabase/migrations/` — what tables and RLS policies are defined
- `packages/types/` — what shared types exist
- `apps/web/.env.example` — what integrations are already configured
- `docs/` — read ARCHITECTURE.md, DATABASE.md, DEVELOPMENT.md, AUTH_FLOW.md

Report back: what is complete, what is partial, what is missing.

### Step 2 — Gap analysis

Based on the audit and the build order in `VEXERA_PROJECT_PLAN.md` (steps 4–18), identify:
- What backend services need to be created from scratch
- What frontend modules need to be created from scratch
- What already-existing scaffolds need to be filled in
- What DB migrations are still needed

### Step 3 — Agent team plan

Decompose Phase 1 into **parallel workstreams** that an agent team can execute. For each workstream define:
- Agent role name (e.g., "Backend: Document Service Agent")
- Exact files to create or modify
- Dependencies on other agents (what must be done first)
- Acceptance criteria (what must work for this to be considered done)

**Suggested agent roles:**
- **Backend: Document & OCR Agent** — Document Service, file upload middleware, OCR async worker, queue integration (BullMQ/Redis), S3 service
- **Backend: Email Integration Agent** — Gmail OAuth2 service, email poller cron job, attachment extractor, duplicate detection
- **Backend: Bank & Reconciliation Agent** — CSV/MT940 parser, BankTransaction service, auto-matching engine (VS + amount)
- **Backend: Rules & Export Agent** — IF-THEN rules engine, categorization applier, Pohoda/Money CSV adapter (pluggable ExportAdapter interface), async export jobs
- **Backend: Notifications & Audit Agent** — in-app notifications model, email notification templates, audit interceptor, audit log API
- **Backend: Analytics & Dashboard Agent** — dashboard data aggregation queries, entrepreneur P&L/VAT calculations, accountant productivity metrics
- **Frontend: Documents Module Agent** — document list page, document detail page, upload component, accountant inbox, bulk approve actions
- **Frontend: Bank Module Agent** — bank transactions list, import wizard UI, manual reconciliation UI
- **Frontend: Dashboards Agent** — entrepreneur dashboard, accountant dashboard, "What does my accountant need?" task panel widget
- **Frontend: Onboarding Agent** — 5-step onboarding wizard, progress bar, skip logic, completion tracking banner
- **QA & Security Agent** — Playwright E2E tests for happy paths, tenant isolation tests (user from tenant A cannot see data from tenant B), cross-tenant security assertions in CI

### Step 4 — Sprint plan

Organize the agent workstreams into **3 sprints** (roughly 3-week cycles):

**Sprint 1 — Core backend (no UI):**
Document Service + OCR + File upload + Email integration + Bank import + Reconciliation engine. All tested via API calls (curl / Postman). No frontend work until these pass gate tests.

**Sprint 2 — Rules, export, notifications + frontend core:**
Rules engine + Export adapters + Notifications + Audit log + Frontend shell improvements + Documents module UI + Bank module UI.

**Sprint 3 — Dashboards, onboarding, E2E:**
Both dashboards (entrepreneur + accountant) + Onboarding wizard + Task panel + E2E Playwright tests + Security audit.

### Step 5 — Start executing

After producing the plan, begin with **Sprint 1, Agent 1: Backend Document Service**.

Build in this exact order:
1. Create/verify the `Document` DB migration (if not already in `supabase/migrations/`) with all required fields: `id, company_id, tenant_id, type, status, file_path, extracted_data, category, vat_mode, amounts, created_at, updated_at`
2. Add RLS policy: users can only read/write documents where `tenant_id` matches their JWT claim
3. Create `apps/web/src/lib/services/document.service.ts` — CRUD operations with automatic `tenant_id` filtering from session
4. Create `apps/web/src/app/api/documents/route.ts` — GET list + POST upload endpoint returning `202 Accepted` + `job_id`
5. Create `apps/web/src/lib/queue/ocr.worker.ts` — async OCR job using BullMQ (Redis), 3 retry attempts with exponential backoff, 60s timeout
6. Create `apps/web/src/lib/services/storage.service.ts` — S3 presigned URL generation for upload and download
7. Write unit tests: tenant isolation (tenant A cannot read tenant B's documents), status state machine transitions

---

## CRITICAL IMPLEMENTATION RULES

These apply to every agent and every file:

1. **tenant_id is sacred.** Every DB query MUST be filtered by `tenant_id` derived from the authenticated session/JWT. Never trust `tenant_id` from request body. Use Supabase RLS as the last line of defense, but also enforce it at the service layer.

2. **No synchronous heavy operations.** OCR, email polling, bank import, export generation — all async via queue. Return `202 Accepted` immediately with a job ID.

3. **Pluggable adapters for export.** Define `ExportAdapter` interface first. `PohoadaAdapter` and `MoneyAdapter` both implement it. Never hardcode export format logic inline.

4. **Type everything.** All new types go in `packages/types/src/`. Import from `@vexera/types`. No `any`.

5. **Zod validation on all API inputs.** Use existing pattern from the codebase.

6. **Every new endpoint needs an audit log entry.** Import and call `auditLog.record()` for: document create/edit/status-change, bank import, export generated, rule created/modified, login events.

7. **Test tenant isolation in CI.** The test file `tests/security/tenant-isolation.spec.ts` must pass on every commit.

---

## OUTPUT FORMAT FOR THE PLAN

Structure your execution plan as:

```
## CODEBASE AUDIT RESULTS
[what exists, what's missing]

## AGENT TEAM: SPRINT 1
### Agent: [Name]
- Files to create: [list]
- Files to modify: [list]  
- Dependencies: [other agents or migrations that must be done first]
- Acceptance criteria: [what curl/test command proves it works]

[repeat for each agent]

## AGENT TEAM: SPRINT 2
[same structure]

## AGENT TEAM: SPRINT 3
[same structure]

## EXECUTION — STARTING NOW
[begin Sprint 1, Agent 1]
```

---

## REFERENCE

Full product specification is in `VEXERA_PROJECT_PLAN.md`. If you need to verify:
- User personas and activation events → Section 3
- Complete FR1–FR20 feature list → Section 6
- API contract details → Section 9
- Onboarding flow details → Section 10
- Success metrics → Section 11
