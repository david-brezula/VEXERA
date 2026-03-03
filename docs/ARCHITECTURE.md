# Architecture

This document explains how the Vexera system is designed and how the different pieces connect.

---

## Bird's-eye View

```
Browser
  │
  ├─ Next.js App Router (apps/web)
  │     ├─ Server Components  → read data directly from DB (no API round-trip)
  │     ├─ Client Components  → interactive UI, React state
  │     └─ API Routes         → server-side actions (file uploads, webhooks)
  │
  ├─ Supabase (cloud)
  │     ├─ PostgreSQL  → all business data
  │     ├─ Auth        → user sessions, JWTs
  │     └─ RLS         → row-level security (prevents cross-org data access)
  │
  ├─ AWS S3
  │     └─ File storage (invoices PDFs, scanned documents)
  │
  └─ Stripe
        └─ Subscription billing (scaffold only in Phase 0)
```

---

## Multi-Tenancy: How It Works

**Multi-tenancy** means many different companies (organizations) share the same app and database, but each can only see their own data.

### The concept

```
User A  ─── member of ──►  Org "Acme s.r.o."
User A  ─── member of ──►  Org "Beta Ltd."    ← same user, 2 orgs
User B  ─── member of ──►  Org "Acme s.r.o."
```

At any moment, User A has one **active organization**. All data they see (invoices, documents, ledger) belongs to that org.

### How the active org is tracked

1. When a user creates or switches to an org, we write a cookie:
   ```
   active_organization_id=<uuid>
   ```
2. The `OrganizationProvider` reads this cookie on load.
3. Every data query filters by `activeOrg.id`.

### How the database enforces isolation

Every important table has an `organization_id` column. Supabase **Row Level Security (RLS)** policies ensure a user can only `SELECT`, `INSERT`, or `UPDATE` rows where `organization_id` is in their list of orgs.

```sql
-- Example: users can only see their own organization's invoices
CREATE POLICY "invoices_select" ON invoices FOR SELECT
  USING (organization_id = ANY(get_accessible_organization_ids()));
```

`get_accessible_organization_ids()` is a helper function that returns all org IDs the current user belongs to (either as a member or as an accountant).

> **Key insight:** RLS is enforced at the database level, not in application code. Even if a bug existed in the app, users could never read another org's data.

---

## The Provider Stack

Providers wrap the whole app and make data available via React context. The nesting order matters:

```
RootLayout
  └── SupabaseProvider         ← creates the Supabase client, tracks auth session
        └── QueryProvider      ← sets up TanStack Query (data fetching cache)
              └── OrganizationProvider  ← fetches user's orgs, tracks active org
                    └── Page content
```

### SupabaseProvider
- Creates a single Supabase browser client (reused everywhere)
- Listens for auth state changes (`onAuthStateChange`)
- Exposes `supabase`, `user`, `isLoading` via `useSupabase()` hook

### QueryProvider
- Wraps `QueryClientProvider` from TanStack Query
- Cache: queries are considered fresh for 60 seconds, don't refetch on window focus

### OrganizationProvider
- Fetches all orgs the user belongs to (via `organization_members` join)
- Tracks `activeOrg` (from cookie)
- Exposes `activeOrg`, `userOrgs`, `switchOrg()`, `isLoading` via `useOrganization()` hook

---

## Next.js Route Groups

Route groups (folders in parentheses) let you share layouts without affecting the URL.

```
src/app/
├── (auth)/          ← centered card layout, no sidebar
│   ├── login/
│   └── register/
│
└── (dashboard)/     ← sidebar + header layout
    ├── page.tsx     → URL: /
    ├── invoices/    → URL: /invoices
    ├── documents/   → URL: /documents
    ├── ledger/      → URL: /ledger
    ├── onboarding/  → URL: /onboarding
    └── settings/    → URL: /settings
```

The `(auth)` and `(dashboard)` folder names don't appear in URLs — they only control which `layout.tsx` is applied.

---

## Middleware (Route Protection)

`src/middleware.ts` runs on every request before the page loads.

**Public routes** (no auth needed):
- `/login`
- `/register`
- `/invite/*`
- `/api/auth/callback`

**Protected routes** (auth required):
- Everything else

If an unauthenticated user hits `/invoices`, the middleware redirects them to `/login`. If a logged-in user hits `/login`, they're sent to `/`.

---

## Data Fetching Patterns

### Pattern 1: Client Component with TanStack Query (most common)

```tsx
"use client"

const { data, isLoading } = useQuery({
  queryKey: ["invoices", activeOrg?.id],
  queryFn: async () => {
    const { data } = await supabase
      .from("invoices")
      .select("*")
      .eq("organization_id", activeOrg!.id)
      .order("created_at", { ascending: false })
    return data
  },
  enabled: !!activeOrg,
})
```

The `queryKey` array is like a cache ID. If `activeOrg.id` changes (org switch), the query automatically re-runs.

### Pattern 2: Mutations (write operations)

```tsx
const { mutate, isPending } = useMutation({
  mutationFn: async (values) => {
    const { error } = await supabase
      .from("invoices")
      .insert({ ...values, organization_id: activeOrg!.id })
    if (error) throw error
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["invoices"] })
    toast.success("Invoice created")
  },
  onError: (error) => {
    toast.error(error.message)
  },
})
```

After a successful write, we call `invalidateQueries` to tell TanStack Query to re-fetch fresh data.

---

## File Storage Architecture

Files are never stored in the database (only metadata is). Actual files live in S3.

**Upload flow:**
```
Browser → POST /api/storage/upload  → verify auth + org membership
        ← presigned PUT URL         ← browser
Browser → PUT <presigned-url>       → S3 directly (no server middleman)
Browser → PATCH /api/... (save file_path to DB)
```

**Download flow:**
```
Browser → GET /api/storage/download?key=...  → verify auth + org membership
        ← presigned GET URL                  ← browser
Browser → GET <presigned-url>                → S3 directly
```

S3 keys follow this format:
```
{organizationId}/{year}/{month}/{uuid}/{filename}
```
Example: `abc-123/2025/01/def-456/invoice.pdf`

This means files are logically isolated per organization by key prefix.

---

## Shared Packages

### `@vexera/types`

TypeScript types shared across all apps. Contains:
- **Auto-generated Supabase types** (`Database` type from `database.types.ts`) — run `supabase gen types` to regenerate
- **Domain types** (`InvoiceStatus`, `OrganizationRole`, `VatRate`, etc.)

Import example:
```typescript
import type { InvoiceStatus, OrganizationRole } from "@vexera/types"
```

### `@vexera/utils`

Pure utility functions:
- **`formatEur(amount)`** — formats number as `1 234,56 €` (Slovak locale)
- **`calculateVatAmount(net, rate)`** — computes VAT from net price
- **`calculateGrossAmount(net, rate)`** — net + VAT
- **`calculateNetFromGross(gross, rate)`** — reverse VAT calculation

Import example:
```typescript
import { formatEur, calculateVatAmount } from "@vexera/utils"
```

---

## VAT Rates (Slovak-specific)

Slovakia uses four VAT rates:

| Rate | Used for |
|---|---|
| 20% | Standard goods and services |
| 10% | Food, pharmaceuticals, books |
| 5% | Some food items, social housing |
| 0% | Intra-EU supply, exports |

These are defined in `packages/utils/src/vat.ts`.

---

## Subscription Plans

Defined as a PostgreSQL CHECK constraint on `organizations.subscription_plan`:

| Plan | Target |
|---|---|
| `free` | Individuals, testing |
| `freelancer` | Self-employed |
| `small_business` | Up to ~10 employees |
| `medium_business` | Larger companies |
| `accounting_firm` | Accountants managing multiple client organizations |

Billing is handled via Stripe (scaffolded in Phase 0, not yet active).
