# VEXERA Feature-Slice Refactor Design

> Date: 2026-03-22 | Status: Approved

## Problem

The codebase uses a layer-based structure (actions/, services/, data/, components/) where related code for one feature is scattered across 5+ directories. This creates:

- **Duplicate logic** — same auth/org checks repeated ~100 times across actions
- **No clear architecture** — 4 overlapping data flow patterns (server actions, API routes, hooks+API, data fetchers)
- **Hard to add features** — a new feature requires touching 5+ directories
- **111 components, 59 API routes, 23 action files, 49 services** with unclear boundaries

## Solution: Feature-Slice Architecture

Reorganize from layer-based to feature-based. Each domain (invoices, bank, documents, etc.) becomes a self-contained folder.

### Constraints

- **Invoicing is critical** — move last, test carefully
- **Reorganize + consolidate** — not a rewrite. Existing logic is preserved, just relocated and deduplicated
- **app/api/ stays** — Next.js requires file-based routing for API routes

## New Directory Structure

```
src/
├── features/
│   ├── invoices/           # actions, services, data, hooks, components, schemas
│   ├── bank/
│   ├── documents/
│   ├── contacts/
│   ├── products/
│   ├── ledger/
│   ├── rules/
│   ├── reports/
│   │   ├── dashboard/
│   │   ├── cashflow/
│   │   ├── vat/
│   │   ├── tax/
│   │   └── health-checks/
│   ├── export/
│   ├── notifications/
│   ├── chat/
│   ├── settings/
│   ├── onboarding/
│   └── auth/
│
├── shared/
│   ├── components/         # ui/, layout/, charts/
│   ├── hooks/              # use-count-up, use-intersection-observer, etc.
│   ├── services/           # audit, queue, tags, legislative, register-lookup
│   ├── lib/                # pagination, query-keys, api-utils, action-utils
│   └── types/
│
├── lib/                    # Infrastructure only (no business logic)
│   ├── supabase/
│   ├── s3/
│   ├── env.ts
│   └── validations/
│
├── app/                    # Thin routing shell
│   ├── (auth)/
│   ├── (dashboard)/        # pages become thin shells importing from features/
│   └── api/                # stays as-is
│
└── providers/
```

### Standard Feature Folder

Small features (contacts, products):
```
features/contacts/
├── actions.ts
├── hooks.ts
├── schemas.ts
├── types.ts
└── components/
    ├── contacts-page-client.tsx
    ├── contact-picker.tsx
    └── contact-form.tsx
```

Large features add service.ts and subdirectories as needed.

## Data Flow Consolidation

### Before: 4 overlapping patterns

1. Page → Server Action → Supabase
2. Page → API Route → Supabase
3. Page → Hook → API Route → Supabase
4. Page → Data fetcher → Supabase

### After: 2 standard patterns

```
Mutations: Component → Server Action → Service → Supabase
Reads:     Component → Hook (React Query) → Server Action → Supabase
```

### What gets removed

- **~38 API routes** that duplicate server actions — replaced by server actions
- **lib/data/*.ts** — merged into feature actions as query functions
- **Redundant service wrappers** — simple CRUD goes directly through actions

### API routes that stay (~20)

Webhooks, cron, file operations, OAuth callbacks, email tracking pixel, queue processing.

## Shared Patterns

### ActionResult type

```typescript
type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }
```

All server actions return this shape.

### Auth guard

```typescript
// shared/lib/action-utils.ts
export async function withAuth() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const orgId = await getActiveOrgId()
  if (!user) throw new ActionError("Not authenticated")
  if (!orgId) throw new ActionError("No active organization")
  return { supabase, user, orgId }
}
```

Eliminates ~100 repetitions of auth/org boilerplate.

### Standard hook pattern

```typescript
export function useContacts(filters?: ContactFilters) {
  const { activeOrg } = useOrganization()
  return useQuery({
    queryKey: ["contacts", activeOrg?.id, filters],
    queryFn: () => getContactsAction(filters),
    enabled: !!activeOrg?.id,
  })
}
```

## Migration Order

| Phase | Features | Risk | Rationale |
|-------|----------|------|-----------|
| 1 | contacts, products | Low | Smallest, establish patterns |
| 2 | chat, onboarding | Low | Self-contained |
| 3 | shared/ extraction | Low | Extract auth utils, audit, queue, tags |
| 4 | rules, notifications | Medium | Moderate dependencies |
| 5 | documents, bank | Medium | Larger, interdependent |
| 6 | ledger, export | Medium | Complex posting logic |
| 7 | reports | Medium | Largest domain (26 files) |
| 8 | settings, auth | Medium | Touches providers/middleware |
| 9 | invoices | Low-Medium | Critical path, mostly file moves |
| 10 | Cleanup | Low | Remove empty dirs, final verification |

### Per-phase process

1. Create feature folder with new structure
2. Move files, update imports
3. Consolidate: merge data/ into actions, remove redundant API routes
4. Apply standard patterns (ActionResult, withAuth, hooks)
5. Verify `pnpm tsc --noEmit` passes
6. Smoke test the feature

## What Stays Unchanged

- `app/api/` file-based routing
- `providers/` directory
- `middleware.ts`
- `packages/types/` (database types)
- Supabase client setup in `lib/supabase/`
