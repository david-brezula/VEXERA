# VEXERA Feature-Slice Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reorganize from layer-based to feature-slice architecture where each domain is self-contained.

**Architecture:** Move ~200 files from flat layer directories (lib/actions/, lib/services/, lib/data/, hooks/, components/) into feature folders (features/<domain>/). Consolidate 4 data flow patterns into 2. Extract shared utilities. Thin out page shells.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase, TanStack Query, React Hook Form + Zod, Tailwind + shadcn/ui

**Design doc:** `docs/plans/2026-03-22-feature-slice-refactor-design.md`

---

## Pre-Flight

### Task 0: Create base directory structure

**Files:**
- Create: `src/features/` (empty)
- Create: `src/shared/` (empty)

**Step 1: Create all feature directories**

```bash
cd apps/web/src
mkdir -p features/{contacts,products,chat,onboarding,rules,notifications,documents,bank,ledger,export,reports,settings,auth,invoices}/{components,}
mkdir -p shared/{components,hooks,services,lib,types}
```

**Step 2: Verify structure**

```bash
ls features/
```
Expected: all 14 feature directories

**Step 3: Commit**

```bash
git add -A && git commit -m "chore: create feature-slice directory structure"
```

---

## Phase 1: Contacts + Products (smallest features, establish patterns)

### Task 1: Create shared/lib/action-utils.ts

This utility eliminates the repeated auth/org boilerplate across all actions. Must be created first since all refactored actions will use it.

**Files:**
- Create: `src/shared/lib/action-utils.ts`

**Step 1: Create the utility**

```typescript
// src/shared/lib/action-utils.ts
"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"

export class ActionError extends Error {
  constructor(message: string) {
    super(message)
    this.name = "ActionError"
  }
}

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export async function withAuth() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const orgId = await getActiveOrgId()
  if (!user) throw new ActionError("Not authenticated")
  if (!orgId) throw new ActionError("No active organization")
  return { supabase, user, orgId }
}

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data }
}

export function err<T>(error: string): ActionResult<T> {
  return { success: false, error }
}
```

**Step 2: Verify TypeScript compiles**

```bash
cd apps/web && pnpm tsc --noEmit
```
Expected: no errors

**Step 3: Commit**

```bash
git add -A && git commit -m "feat: add shared action-utils with withAuth, ActionResult, ok/err helpers"
```

---

### Task 2: Move contacts to feature slice

**Files:**
- Create: `src/features/contacts/actions.ts` (consolidate from lib/actions/contacts.ts + lib/services/contacts.service.ts)
- Move: `src/lib/services/contacts.service.ts` → `src/features/contacts/service.ts`
- Move: `src/hooks/use-contacts.ts` → `src/features/contacts/hooks.ts`
- Move: `src/components/contacts/*` → `src/features/contacts/components/`
- Update: `src/app/(dashboard)/contacts/page.tsx` (update imports)

**Step 1: Move service file**

```bash
cp src/lib/services/contacts.service.ts src/features/contacts/service.ts
```

**Step 2: Move actions file**

```bash
cp src/lib/actions/contacts.ts src/features/contacts/actions.ts
```

Update the import in `actions.ts` from `@/lib/services/contacts.service` to `./service`.

**Step 3: Move hooks file**

```bash
cp src/hooks/use-contacts.ts src/features/contacts/hooks.ts
```

Update imports to reference `./service` instead of `@/lib/services/contacts.service`.

**Step 4: Move component files**

```bash
cp src/components/contacts/contact-form.tsx src/features/contacts/components/
cp src/components/contacts/contact-table.tsx src/features/contacts/components/
cp src/components/contacts/contacts-page-client.tsx src/features/contacts/components/
cp src/components/contacts/ico-lookup-input.tsx src/features/contacts/components/
```

Update internal imports within components to use `../hooks`, `../actions`, etc.

**Step 5: Create barrel export**

```typescript
// src/features/contacts/index.ts
export * from "./actions"
export * from "./hooks"
export { ContactsPageClient } from "./components/contacts-page-client"
```

**Step 6: Update page shell**

Update `src/app/(dashboard)/contacts/page.tsx` to import from `@/features/contacts` instead of `@/components/contacts`.

**Step 7: Update API routes**

Update `src/app/api/contacts/route.ts` and `src/app/api/contacts/[id]/route.ts` to import from `@/features/contacts/service` instead of `@/lib/services/contacts.service`.

Same for `import/route.ts` and `lookup/route.ts`.

**Step 8: Delete old files**

```bash
rm src/lib/actions/contacts.ts
rm src/lib/services/contacts.service.ts
rm src/hooks/use-contacts.ts
rm -rf src/components/contacts/
```

**Step 9: Verify**

```bash
pnpm tsc --noEmit
```
Expected: no errors

**Step 10: Commit**

```bash
git add -A && git commit -m "refactor: move contacts to feature slice"
```

---

### Task 3: Move products to feature slice

Same pattern as contacts.

**Files:**
- Move: `src/lib/services/products.service.ts` → `src/features/products/service.ts`
- Move: `src/hooks/use-products.ts` → `src/features/products/hooks.ts`
- Move: `src/components/products/*` → `src/features/products/components/`
- Update: `src/app/(dashboard)/products/page.tsx`
- Update: `src/app/api/products/route.ts`, `src/app/api/products/[id]/route.ts`
- Delete: old files

**Steps:** Follow identical pattern to Task 2 (move service → move hooks → move components → create barrel → update page → update API routes → delete old → verify → commit).

**Commit:** `refactor: move products to feature slice`

---

## Phase 2: Chat + Onboarding (self-contained)

### Task 4: Move chat to feature slice

**Files:**
- Move: `src/lib/services/ai-chat.service.ts` → `src/features/chat/service.ts`
- Move: `src/hooks/use-chat.ts` → `src/features/chat/hooks.ts`
- Move: `src/components/chat/*` (5 files) → `src/features/chat/components/`
- Update: `src/app/(dashboard)/chat/page.tsx`
- Update: `src/app/api/chat/route.ts`, `sessions/route.ts`, `sessions/[id]/messages/route.ts`
- Delete: old files

**Steps:** Same pattern as Task 2. Move files, update imports, verify, commit.

**Commit:** `refactor: move chat to feature slice`

---

### Task 5: Move onboarding to feature slice

**Files:**
- Move: `src/components/onboarding/*` (2 files) → `src/features/onboarding/components/`
- Update: `src/app/(dashboard)/onboarding/page.tsx`
- Delete: old `src/components/onboarding/`

**Note:** Onboarding has no actions/services/hooks — just components. This is the simplest move.

**Commit:** `refactor: move onboarding to feature slice`

---

## Phase 3: Extract shared utilities

### Task 6: Move shared services

**Files:**
- Move: `src/lib/services/audit.server.ts` → `src/shared/services/audit.server.ts`
- Move: `src/lib/services/queue.service.ts` → `src/shared/services/queue.service.ts`
- Move: `src/lib/services/tags.service.ts` → `src/shared/services/tags.service.ts`
- Move: `src/lib/services/legislative.service.ts` → `src/shared/services/legislative.service.ts`
- Move: `src/lib/services/register-lookup.service.ts` → `src/shared/services/register-lookup.service.ts`

**Step 1: Move each file**

```bash
cp src/lib/services/audit.server.ts src/shared/services/
cp src/lib/services/queue.service.ts src/shared/services/
cp src/lib/services/tags.service.ts src/shared/services/
cp src/lib/services/legislative.service.ts src/shared/services/
cp src/lib/services/register-lookup.service.ts src/shared/services/
```

**Step 2: Update all imports across the codebase**

Search and replace:
- `@/lib/services/audit.server` → `@/shared/services/audit.server`
- `@/lib/services/queue.service` → `@/shared/services/queue.service`
- `@/lib/services/tags.service` → `@/shared/services/tags.service`
- `@/lib/services/legislative.service` → `@/shared/services/legislative.service`
- `@/lib/services/register-lookup.service` → `@/shared/services/register-lookup.service`

**Step 3: Delete old files**

**Step 4: Verify and commit**

```bash
pnpm tsc --noEmit
git add -A && git commit -m "refactor: move shared services to shared/services/"
```

---

### Task 7: Move shared hooks

**Files:**
- Move: `src/hooks/use-count-up.ts` → `src/shared/hooks/use-count-up.ts`
- Move: `src/hooks/use-intersection-observer.ts` → `src/shared/hooks/use-intersection-observer.ts`
- Move: `src/hooks/use-current-member-role.ts` → `src/shared/hooks/use-current-member-role.ts`
- Move: `src/hooks/use-track-event.ts` → `src/shared/hooks/use-track-event.ts`

**Steps:** Move files, search-and-replace imports, delete old, verify, commit.

**Commit:** `refactor: move shared hooks to shared/hooks/`

---

### Task 8: Move shared lib files

**Files:**
- Move: `src/lib/data/pagination.ts` → `src/shared/lib/pagination.ts`
- Move: `src/lib/api-utils.ts` → `src/shared/lib/api-utils.ts`
- Move: `src/lib/query-keys.ts` → `src/shared/lib/query-keys.ts`

**Steps:** Move files, search-and-replace imports, delete old, verify, commit.

**Commit:** `refactor: move shared lib utilities to shared/lib/`

---

### Task 9: Move shared components

**Files:**
- Move: `src/components/ui/*` → `src/shared/components/ui/`
- Move: `src/components/layout/*` → `src/shared/components/layout/`
- Move: `src/components/charts/*` → `src/shared/components/charts/`
- Move: `src/components/shared/*` → `src/shared/components/shared/`

**Warning:** `components/ui/` is imported by nearly every file. Use a global search-and-replace for imports:
- `@/components/ui/` → `@/shared/components/ui/`
- `@/components/layout/` → `@/shared/components/layout/`
- `@/components/charts/` → `@/shared/components/charts/`
- `@/components/shared/` → `@/shared/components/shared/`

**Steps:** Move directories, global search-and-replace, verify, commit.

**Commit:** `refactor: move shared components (ui, layout, charts) to shared/`

---

## Phase 4: Rules + Notifications

### Task 10: Move rules to feature slice

**Files:**
- Move: `src/lib/actions/rules.ts` → `src/features/rules/actions.ts`
- Move: `src/lib/actions/categorization.ts` → `src/features/rules/actions-categorization.ts`
- Move: `src/lib/actions/patterns.ts` → `src/features/rules/actions-patterns.ts`
- Move: `src/lib/services/rules-engine.service.ts` → `src/features/rules/service.ts`
- Move: `src/lib/services/categorization.service.ts` → `src/features/rules/categorization.service.ts`
- Move: `src/lib/services/pattern-detection.service.ts` → `src/features/rules/pattern-detection.service.ts`
- Move: `src/hooks/use-rules.ts` → `src/features/rules/hooks.ts`
- Move: `src/components/rules/*` → `src/features/rules/components/`
- Update: `src/app/(dashboard)/rules/page.tsx`
- Update: `src/app/api/rules/route.ts`, `[id]/route.ts`, `apply/route.ts`, `../categorization/insights/route.ts`

**Steps:** Same pattern. Move, update imports, delete old, verify, commit.

**Commit:** `refactor: move rules to feature slice`

---

### Task 11: Move notifications to feature slice

**Files:**
- Move: `src/lib/services/notification.service.ts` → `src/features/notifications/service.ts`
- Move: `src/lib/services/email.service.ts` → `src/features/notifications/email.service.ts`
- Move: `src/lib/services/email-tracking.service.ts` → `src/features/notifications/email-tracking.service.ts`
- Move: `src/lib/services/gmail.service.ts` → `src/features/notifications/gmail.service.ts`
- Move: `src/hooks/use-notifications.ts` → `src/features/notifications/hooks.ts`
- Move: `src/lib/data/inbox.ts` → `src/features/notifications/data.ts`
- Move: `src/components/inbox/*` → `src/features/notifications/components/`
- Update: API routes for `/api/notifications`, `/api/email/*`

**Commit:** `refactor: move notifications to feature slice`

---

## Phase 5: Documents + Bank

### Task 12: Move documents to feature slice

**Files:**
- Move: `src/lib/actions/documents.ts` → `src/features/documents/actions.ts`
- Move: `src/lib/actions/ocr.ts` → `src/features/documents/actions-ocr.ts`
- Move: `src/lib/services/document.service.ts` → `src/features/documents/service.ts`
- Move: `src/lib/services/ocr.service.ts` → `src/features/documents/ocr.service.ts`
- Move: `src/lib/services/duplicate-detection.service.ts` → `src/features/documents/duplicate-detection.service.ts`
- Move: `src/lib/services/storage.service.ts` → `src/features/documents/storage.service.ts`
- Move: `src/lib/data/documents.ts` → merge into `src/features/documents/actions.ts`
- Move: `src/hooks/use-documents.ts` → `src/features/documents/hooks.ts`
- Move: `src/components/documents/*` → `src/features/documents/components/`
- Update: all document API routes

**Commit:** `refactor: move documents to feature slice`

---

### Task 13: Move bank to feature slice

**Files:**
- Move: `src/lib/services/bank-import.service.ts` → `src/features/bank/service.ts`
- Move: `src/lib/services/reconciliation.service.ts` → `src/features/bank/reconciliation.service.ts`
- Move: `src/hooks/use-bank.ts` → `src/features/bank/hooks.ts`
- Move: `src/components/bank/*` → `src/features/bank/components/`
- Update: all bank API routes

**Commit:** `refactor: move bank to feature slice`

---

## Phase 6: Ledger + Export

### Task 14: Move ledger to feature slice

**Files:**
- Move: `src/lib/actions/ledger.ts` → `src/features/ledger/actions.ts`
- Move: `src/lib/actions/fiscal-periods.ts` → `src/features/ledger/actions-fiscal-periods.ts`
- Move: `src/lib/actions/ledger-settings.ts` → `src/features/ledger/actions-settings.ts`
- Move: `src/lib/actions/chart-of-accounts.ts` → `src/features/ledger/actions-chart.ts`
- Move: `src/lib/actions/invoice-posting.ts` → `src/features/ledger/actions-posting.ts`
- Move: `src/lib/data/ledger.ts` → merge into actions
- Move: `src/lib/data/ledger-settings.ts` → merge into actions-settings
- Move: `src/lib/data/fiscal-periods.ts` → merge into actions-fiscal-periods
- Move: `src/components/ledger/*` → `src/features/ledger/components/`

**Commit:** `refactor: move ledger to feature slice`

---

### Task 15: Move export to feature slice

**Files:**
- Move: `src/lib/actions/xml-export.ts` → `src/features/export/actions.ts`
- Move: `src/lib/actions/report-export.ts` → `src/features/export/actions-report.ts`
- Move: `src/lib/services/export/*` → `src/features/export/services/`
- Move: `src/lib/services/xml/*` → `src/features/export/xml/`
- Move: `src/components/export/*` → `src/features/export/components/`
- Update: `/api/export/route.ts`

**Commit:** `refactor: move export to feature slice`

---

## Phase 7: Reports (largest domain)

### Task 16: Move reports to feature slice

Reports is the largest domain (26 files). Split into sub-features:

**Files:**
- Move: `src/lib/actions/cashflow.ts` → `src/features/reports/cashflow/actions.ts`
- Move: `src/lib/actions/vat-returns.ts` → `src/features/reports/vat/actions.ts`
- Move: `src/lib/actions/report-drilldown.ts` → `src/features/reports/actions-drilldown.ts`
- Move: `src/lib/services/vat.service.ts` → `src/features/reports/vat/service.ts`
- Move: `src/lib/services/cashflow.service.ts` → `src/features/reports/cashflow/service.ts`
- Move: `src/lib/services/cashflow-scenarios.service.ts` → `src/features/reports/cashflow/scenarios.service.ts`
- Move: `src/lib/services/health-check.service.ts` → `src/features/reports/health-checks/service.ts`
- Move: `src/lib/services/analytics.service.ts` → `src/features/reports/analytics.service.ts`
- Move: `src/lib/services/reports/*` → `src/features/reports/services/`
- Move: `src/lib/data/vat.ts` → merge into `src/features/reports/vat/actions.ts`
- Move: `src/lib/data/cashflow.ts` → merge into `src/features/reports/cashflow/actions.ts`
- Move: `src/lib/data/dashboard.ts` → `src/features/reports/dashboard/data.ts`
- Move: `src/lib/data/accountant-dashboard.ts` → `src/features/reports/dashboard/accountant-data.ts`
- Move: `src/lib/data/accountant-needs.ts` → `src/features/reports/dashboard/accountant-needs.ts`
- Move: `src/lib/data/financial-stats.ts` → `src/features/reports/dashboard/financial-stats.ts`
- Move: `src/lib/data/freelancer-tax.ts` → `src/features/reports/tax/freelancer-data.ts`
- Move: `src/lib/data/income-tax.ts` → `src/features/reports/tax/income-data.ts`
- Move: `src/hooks/use-reports.ts` → `src/features/reports/hooks.ts`
- Move: `src/hooks/use-health-checks.ts` → `src/features/reports/health-checks/hooks.ts`
- Move: `src/components/dashboard/*` → `src/features/reports/dashboard/components/`
- Move: `src/components/reports/*` → `src/features/reports/components/`
- Move: `src/components/health-checks/*` → `src/features/reports/health-checks/components/`
- Update: all report-related API routes and pages

**Commit:** `refactor: move reports to feature slice`

---

## Phase 8: Settings + Auth

### Task 17: Move settings to feature slice

**Files:**
- Move: `src/lib/actions/members.ts` → `src/features/settings/actions-members.ts`
- Move: `src/lib/services/archive.service.ts` → `src/features/settings/archive.service.ts`
- Move: `src/lib/data/org.ts` → `src/features/settings/data-org.ts`
- Move: `src/components/settings/*` → `src/features/settings/components/`
- Move: `src/components/members/*` → `src/features/settings/components/members/`
- Update: settings pages and API routes

**Important:** `lib/data/org.ts` exports `getActiveOrgId()` which is used everywhere. After moving, update the import path OR keep a re-export at the old path temporarily.

**Commit:** `refactor: move settings to feature slice`

---

### Task 18: Move auth to feature slice

**Files:**
- Move auth-related components if any exist in `src/components/`
- Update: `src/app/(auth)/login/page.tsx`, `register/page.tsx`, `invite/[token]/page.tsx`

**Note:** Auth is mostly in `app/(auth)/` pages already. This is primarily about ensuring imports point to the right places.

**Commit:** `refactor: move auth to feature slice`

---

## Phase 9: Invoices (critical, move last)

### Task 19: Move invoices to feature slice

**CRITICAL PATH — test thoroughly after this move.**

**Files:**
- Move: `src/lib/actions/invoices.ts` → `src/features/invoices/actions.ts`
- Move: `src/lib/actions/pay-by-square.ts` → `src/features/invoices/actions-qr.ts`
- Move: `src/lib/actions/invoice-template.ts` → `src/features/invoices/actions-template.ts`
- Move: `src/lib/actions/e-invoice.ts` → `src/features/invoices/actions-e-invoice.ts`
- Move: `src/lib/services/invoice-email.service.ts` → `src/features/invoices/email.service.ts`
- Move: `src/lib/services/payment.service.ts` → `src/features/invoices/payment.service.ts`
- Move: `src/lib/services/recurring-invoice.service.ts` → `src/features/invoices/recurring.service.ts`
- Move: `src/lib/data/invoices.ts` → merge into `src/features/invoices/actions.ts`
- Move: `src/hooks/use-invoices.ts` → `src/features/invoices/hooks.ts`
- Move: `src/hooks/use-recurring-invoices.ts` → `src/features/invoices/hooks-recurring.ts`
- Move: `src/components/invoices/*` → `src/features/invoices/components/`
- Move: `src/lib/validations/invoice.schema.ts` → `src/features/invoices/schemas.ts`
- Move: `src/lib/types/invoice-template.ts` → `src/features/invoices/types.ts`
- Update: all invoice-related API routes and pages

**Step 1:** Move all files
**Step 2:** Update all imports
**Step 3:** Verify TypeScript: `pnpm tsc --noEmit`
**Step 4:** Build: `pnpm build`
**Step 5:** Manual smoke test: create invoice, view PDF, send email, view recurring

**Commit:** `refactor: move invoices to feature slice`

---

## Phase 10: Cleanup

### Task 20: Remove empty old directories

**Step 1: Verify old directories are empty**

```bash
find src/lib/actions -type f 2>/dev/null | wc -l    # should be 0
find src/lib/services -type f 2>/dev/null | wc -l   # should be 0
find src/lib/data -type f 2>/dev/null | wc -l       # should be 0 (except org.ts if re-exported)
find src/hooks -type f 2>/dev/null | wc -l           # should be 0
find src/components -mindepth 1 -type f 2>/dev/null | wc -l  # should be 0
```

**Step 2: Remove empty directories**

```bash
rm -rf src/lib/actions src/lib/data src/components
# Keep src/lib/services only if some infra services remain
# Keep src/hooks only if empty
```

**Step 3: Final verification**

```bash
pnpm tsc --noEmit
pnpm build
```
Expected: both pass with zero errors

**Step 4: Grep for broken imports**

```bash
grep -r "@/lib/actions/" src/ --include="*.ts" --include="*.tsx"
grep -r "@/lib/services/" src/ --include="*.ts" --include="*.tsx"
grep -r "@/hooks/" src/ --include="*.ts" --include="*.tsx"
grep -r "@/components/" src/ --include="*.ts" --include="*.tsx"
```
Expected: no results (all imports updated to @/features/ or @/shared/)

**Step 5: Commit**

```bash
git add -A && git commit -m "chore: remove empty old directories, refactor complete"
```

---

## Verification Checklist

After all phases, verify:

- [ ] `pnpm tsc --noEmit` — zero errors
- [ ] `pnpm build` — successful build
- [ ] No imports referencing old paths (`@/lib/actions/`, `@/lib/services/`, `@/hooks/`, `@/components/`)
- [ ] Manual test: login, org switching, invoice CRUD, document upload, bank import, dashboard loads
- [ ] No empty directories remaining in src/
