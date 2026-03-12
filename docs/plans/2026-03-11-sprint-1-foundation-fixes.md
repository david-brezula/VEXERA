# Sprint 1: Foundation Fixes — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all critical bugs, security issues, and scalability blockers before building new features.

**Architecture:** Six independent fix tasks targeting the data layer (`apps/web/src/lib/data/`), a broken migration (`supabase/migrations/`), RLS policy gaps, OAuth token security, pagination across all list endpoints, and a broken UI filter. Each task is self-contained and can be worked in any order.

**Tech Stack:** Next.js 15 (App Router), Supabase (PostgreSQL + RLS), TypeScript, TanStack Query, React Server Components

---

## Task 1: Fix VAT Double-Counting Bug

The VAT dashboard widget counts documents and invoices separately. When an invoice also has a linked document row, both the taxable base and VAT amounts are counted twice.

**Files:**
- Modify: `apps/web/src/lib/data/vat.ts:26-153`

**Step 1: Understand the bug**

In `getCurrentQuarterVat()`:
- Lines 84-103: Loop over `documents` rows, adding `vat_amount` and `base` to buckets
- Lines 106-116: Loop over `invoices` rows, adding `base` again (double-count #1: taxable base)
- Lines 118-133: Loop over `invoice_items` rows, adding `vat_amount` again (double-count #2: VAT amounts)

If an invoice exists in both tables, its values are summed twice.

**Step 2: Rewrite to use invoices as the single source of truth**

The fix: Use `invoices` + `invoice_items` as the primary source for VAT calculations. Only use `documents` for rows that do NOT have a linked invoice (i.e., standalone receipts/docs). The `documents` table has an `invoice_id` FK — use it to exclude linked documents.

Replace the entire function body (lines 37-152) with:

```typescript
export async function getCurrentQuarterVat(orgId: string): Promise<VatSummary> {
  const supabase = await createClient()
  const now = new Date()
  const year = now.getFullYear()
  const quarter = Math.ceil((now.getMonth() + 1) / 3)

  // Quarter date range
  const qStartMonth = (quarter - 1) * 3
  const qStart = new Date(year, qStartMonth, 1).toISOString().split("T")[0]!
  const qEnd = new Date(year, qStartMonth + 3, 0).toISOString().split("T")[0]!

  // 1. Get invoices with their line items (primary source)
  const { data: invoices } = await supabase
    .from("invoices")
    .select("id, invoice_type, total, vat_amount")
    .eq("organization_id", orgId)
    .in("status", ["paid", "sent", "overdue"])
    .gte("issue_date", qStart)
    .lte("issue_date", qEnd)
    .is("deleted_at", null)

  type InvRow = { id: string; invoice_type: string; total: number | null; vat_amount: number | null }
  const invRows = (invoices ?? []) as unknown as InvRow[]

  // Get invoice items for per-line VAT bucketing
  const invoiceIds = invRows.map(i => i.id)
  const invoiceTypeMap = new Map(invRows.map(i => [i.id, i.invoice_type]))

  type ItemRow = { invoice_id: string; vat_rate: number | null; vat_amount: number | null }
  let itemRows: ItemRow[] = []
  if (invoiceIds.length > 0) {
    const { data: items } = await supabase
      .from("invoice_items")
      .select("invoice_id, vat_rate, vat_amount")
      .in("invoice_id", invoiceIds)
    itemRows = (items ?? []) as unknown as ItemRow[]
  }

  // 2. Get standalone documents (NOT linked to any invoice)
  const { data: docs } = await supabase
    .from("documents")
    .select("document_type, total_amount, vat_amount, vat_rate")
    .eq("organization_id", orgId)
    .in("status", ["approved", "archived"])
    .gte("issue_date", qStart)
    .lte("issue_date", qEnd)
    .is("deleted_at", null)
    .is("invoice_id", null)  // <-- KEY FIX: exclude docs linked to invoices

  type DocRow = { document_type: string | null; total_amount: number | null; vat_amount: number | null; vat_rate: number | null }
  const docRows = (docs ?? []) as unknown as DocRow[]

  // Initialize VAT buckets
  const vat = {
    output_20: 0, output_10: 0, output_5: 0,
    input_20: 0, input_10: 0, input_5: 0,
    base_output: 0, base_input: 0,
  }

  // Process invoices: taxable base from invoice-level totals
  for (const inv of invRows) {
    const vatAmt = Number(inv.vat_amount) || 0
    const totalAmt = Number(inv.total) || 0
    if (inv.invoice_type === "issued") {
      vat.base_output += totalAmt - vatAmt
    } else {
      vat.base_input += totalAmt - vatAmt
    }
  }

  // Process invoice items: VAT bucketing from per-line rates
  for (const item of itemRows) {
    const vatAmt = Number(item.vat_amount) || 0
    const rate = Number(item.vat_rate) || 20
    const invoiceType = invoiceTypeMap.get(item.invoice_id)
    if (invoiceType === "issued") {
      if (rate >= 18) vat.output_20 += vatAmt
      else if (rate >= 8) vat.output_10 += vatAmt
      else vat.output_5 += vatAmt
    } else {
      if (rate >= 18) vat.input_20 += vatAmt
      else if (rate >= 8) vat.input_10 += vatAmt
      else vat.input_5 += vatAmt
    }
  }

  // Process standalone documents (receipts, scanned docs without invoice link)
  for (const doc of docRows) {
    const vatAmt = Number(doc.vat_amount) || 0
    const totalAmt = Number(doc.total_amount) || 0
    const rate = Number(doc.vat_rate) || 20
    const isOutput = doc.document_type === "invoice_issued" || doc.document_type === "tax_document"
    const isInput = doc.document_type === "invoice_received" || doc.document_type === "receipt"
    if (isOutput) {
      vat.base_output += totalAmt - vatAmt
      if (rate >= 18) vat.output_20 += vatAmt
      else if (rate >= 8) vat.output_10 += vatAmt
      else vat.output_5 += vatAmt
    } else if (isInput) {
      vat.base_input += totalAmt - vatAmt
      if (rate >= 18) vat.input_20 += vatAmt
      else if (rate >= 8) vat.input_10 += vatAmt
      else vat.input_5 += vatAmt
    }
  }

  const totalOutput = vat.output_20 + vat.output_10 + vat.output_5
  const totalInput = vat.input_20 + vat.input_10 + vat.input_5

  return {
    period_label: `Q${quarter} ${year}`,
    vat_output_20: round(vat.output_20),
    vat_output_10: round(vat.output_10),
    vat_output_5: round(vat.output_5),
    vat_input_20: round(vat.input_20),
    vat_input_10: round(vat.input_10),
    vat_input_5: round(vat.input_5),
    total_output_vat: round(totalOutput),
    total_input_vat: round(totalInput),
    vat_liability: round(totalOutput - totalInput),
    taxable_base_output: round(vat.base_output),
    taxable_base_input: round(vat.base_input),
    document_count: invRows.length + docRows.length,
  }
}
```

**Step 3: Verify the fix**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

**Step 4: Commit**

```bash
git add apps/web/src/lib/data/vat.ts
git commit -m "fix: eliminate VAT double-counting by excluding invoice-linked documents

Documents linked to invoices via invoice_id were being counted in both
the documents loop and the invoices loop. Now only standalone documents
(invoice_id IS NULL) are processed from the documents table."
```

---

## Task 2: Fix Invoice Payments Migration

The migration references `total_amount` but the invoices table column is `total`.

**Files:**
- Modify: `supabase/migrations/20240101000041_invoice_payments.sql:44`

**Step 1: Fix the column name**

Change line 44 from:
```sql
  set remaining_amount = coalesce(total_amount, 0) - paid_amount
```
to:
```sql
  set remaining_amount = coalesce(total, 0) - paid_amount
```

**Step 2: Verify migration syntax**

Run: `cd supabase && supabase db diff --local` (if local Supabase is running)
Or manually verify the `invoices` table has a `total` column by checking `supabase/migrations/20240101000008_invoices.sql`.

**Step 3: Commit**

```bash
git add supabase/migrations/20240101000041_invoice_payments.sql
git commit -m "fix: correct column name total_amount -> total in invoice_payments migration

The invoices table uses 'total' not 'total_amount'. The wrong name caused
remaining_amount to always compute as 0 - paid_amount (negative)."
```

---

## Task 3: Tighten RLS Policies on Ledger Tables

RLS exists on both tables (migration 14) but has gaps: no DELETE policy, and accountants can INSERT ledger entries directly (may be intentional for accounting firms, but should be reviewed).

**Files:**
- Create: `supabase/migrations/20240101000043_fix_ledger_rls.sql`

**Step 1: Write the migration**

```sql
-- Fix RLS gaps on chart_of_accounts and ledger_entries
-- Adds DELETE policies and tightens INSERT on ledger_entries to org members only.

-- ─── chart_of_accounts: allow members to delete non-system accounts ──────────

create policy "coa_delete"
  on public.chart_of_accounts for delete
  using (
    organization_id in (select public.get_user_organization_ids())
    and is_system = false
  );

-- ─── ledger_entries: allow members to delete draft entries only ───────────────

create policy "ledger_delete_draft"
  on public.ledger_entries for delete
  using (
    organization_id in (select public.get_user_organization_ids())
    and status = 'draft'
  );
```

Note: The accountant INSERT permission on `ledger_entries` is intentional for accounting firms managing client books. Leave it as-is.

**Step 2: Verify migration**

Run: `cd supabase && supabase migration list` to confirm the new migration is recognized.

**Step 3: Commit**

```bash
git add supabase/migrations/20240101000043_fix_ledger_rls.sql
git commit -m "fix: add DELETE RLS policies for chart_of_accounts and ledger_entries

chart_of_accounts: members can delete non-system accounts for their orgs.
ledger_entries: members can delete draft entries only."
```

---

## Task 4: Add Pagination to All List Endpoints

Every list endpoint fetches unbounded rows. Supabase silently truncates at 1,000 rows. Add pagination with `.range()` and return total count via `{ count: "exact" }`.

**Files:**
- Modify: `apps/web/src/lib/data/invoices.ts` (getInvoices)
- Modify: `apps/web/src/lib/data/documents.ts` (getDocuments)
- Modify: `apps/web/src/lib/data/ledger.ts` (getLedgerEntries)

**Step 1: Add pagination types**

Create a shared pagination type. Add to `apps/web/src/lib/data/invoices.ts` at the top (after imports):

```typescript
export type PaginationParams = {
  page?: number
  pageSize?: number
}

export type PaginatedResult<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}
```

Actually, since this will be reused, create a shared file:

Create: `apps/web/src/lib/data/pagination.ts`

```typescript
export type PaginationParams = {
  page?: number
  pageSize?: number
}

export type PaginatedResult<T> = {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export const DEFAULT_PAGE_SIZE = 50

export function paginationRange(params?: PaginationParams): { from: number; to: number; page: number; pageSize: number } {
  const page = Math.max(1, params?.page ?? 1)
  const pageSize = Math.max(1, Math.min(100, params?.pageSize ?? DEFAULT_PAGE_SIZE))
  const from = (page - 1) * pageSize
  const to = from + pageSize - 1
  return { from, to, page, pageSize }
}
```

**Step 2: Update getInvoices**

Modify `apps/web/src/lib/data/invoices.ts`:

```typescript
import { PaginationParams, PaginatedResult, paginationRange } from "./pagination"

// Change function signature:
export async function getInvoices(
  filters?: InvoiceFilters,
  pagination?: PaginationParams
): Promise<PaginatedResult<InvoiceRow>> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { data: [], total: 0, page: 1, pageSize: 50, totalPages: 0 }

  const { from, to, page, pageSize } = paginationRange(pagination)

  let query = supabase
    .from("invoices")
    .select(
      "id, invoice_number, invoice_type, status, supplier_name, customer_name, issue_date, due_date, total, currency, created_at",
      { count: "exact" }
    )
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(from, to)

  // ... keep all existing filter logic unchanged ...

  const { data, error, count } = await query
  if (error) throw error

  const total = count ?? 0
  const today = new Date().toISOString().slice(0, 10)
  const rows = (data ?? []).map((inv) => ({
    ...inv,
    status:
      inv.status === "sent" && inv.due_date < today
        ? ("overdue" as InvoiceStatus)
        : (inv.status as InvoiceStatus),
    total: Number(inv.total),
    invoice_type: inv.invoice_type as InvoiceType,
  }))

  return {
    data: rows,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}
```

**Step 3: Update getDocuments**

Apply the same pattern to `apps/web/src/lib/data/documents.ts:getDocuments`. Add `{ count: "exact" }` to `.select()`, add `.range(from, to)`, change return type to `PaginatedResult<DocumentRow>`.

**Step 4: Update getLedgerEntries**

Apply the same pattern to `apps/web/src/lib/data/ledger.ts:getLedgerEntries`. Add `{ count: "exact" }` to `.select()`, add `.range(from, to)`, change return type to `PaginatedResult<LedgerEntry>`.

**Step 5: Update consuming pages**

Each page that calls these functions needs to:
1. Read `page` from URL search params (e.g., `?page=2`)
2. Pass it to the data function
3. Render pagination controls

For the **invoices page** (`apps/web/src/app/(dashboard)/invoices/page.tsx`):
- Add `page` to the search params destructuring
- Pass `{ page: Number(page) || 1 }` as second arg to `getInvoices()`
- The page component passes `result.data` and `result.totalPages` to the client component
- Client component renders prev/next pagination buttons

For the **documents page** (`apps/web/src/app/(dashboard)/documents/page.tsx`):
- Same pattern as invoices

For the **ledger page** (`apps/web/src/app/(dashboard)/ledger/page.tsx`):
- Same pattern as invoices

**Step 6: Create a reusable pagination UI component**

Create: `apps/web/src/components/ui/pagination-controls.tsx`

```tsx
"use client"

import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

type Props = {
  page: number
  totalPages: number
  total: number
}

export function PaginationControls({ page, totalPages, total }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (totalPages <= 1) return null

  function goToPage(newPage: number) {
    const params = new URLSearchParams(searchParams.toString())
    params.set("page", String(newPage))
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center justify-between border-t pt-4">
      <p className="text-sm text-muted-foreground">
        Page {page} of {totalPages} ({total} total)
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeftIcon className="size-4" />
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => goToPage(page + 1)}
          disabled={page >= totalPages}
        >
          Next
          <ChevronRightIcon className="size-4" />
        </Button>
      </div>
    </div>
  )
}
```

**Step 7: Verify**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors (there will be — consuming components need updated types; fix all callers)

**Step 8: Commit**

```bash
git add apps/web/src/lib/data/pagination.ts apps/web/src/lib/data/invoices.ts apps/web/src/lib/data/documents.ts apps/web/src/lib/data/ledger.ts apps/web/src/components/ui/pagination-controls.tsx
git add apps/web/src/app/\(dashboard\)/invoices/page.tsx apps/web/src/app/\(dashboard\)/documents/page.tsx apps/web/src/app/\(dashboard\)/ledger/page.tsx
git commit -m "feat: add pagination to invoices, documents, and ledger list endpoints

Uses Supabase .range() with { count: 'exact' } for server-side pagination.
Default page size is 50. Adds reusable PaginationControls component."
```

---

## Task 5: Fix Ledger Balances Tab Year/Month Filter

The balances tab has year/month `<Select>` dropdowns that update local state but never trigger a server refetch.

**Files:**
- Modify: `apps/web/src/components/ledger/ledger-client.tsx` (lines ~160, ~325, ~780-900)
- Modify: `apps/web/src/app/(dashboard)/ledger/page.tsx` (line 20)

**Step 1: Add a client-side query for balances**

Instead of passing `balances` as a server prop, use TanStack Query to fetch balances client-side when year/month changes. This way the server page still does the initial fetch, but the client can refetch with different params.

In `ledger-client.tsx`, add a server action or API route for fetching balances. The simplest approach: create a server action.

Create: `apps/web/src/lib/actions/ledger.ts`

```typescript
"use server"

import { getAccountBalances } from "@/lib/data/ledger"
import type { AccountBalance } from "@/lib/data/ledger"

export async function fetchBalancesAction(
  year?: number,
  month?: number
): Promise<AccountBalance[]> {
  return getAccountBalances(year, month)
}
```

**Step 2: Update LedgerClient to use the server action**

In `ledger-client.tsx`, where `balanceYear` and `balanceMonth` are defined (~line 160):

```typescript
import { useQuery } from "@tanstack/react-query"
import { fetchBalancesAction } from "@/lib/actions/ledger"

// Replace the static balances prop usage with a query:
const yearNum = balanceYear ? Number(balanceYear) : undefined
const monthNum = balanceMonth !== "all" ? Number(balanceMonth) : undefined

const { data: currentBalances } = useQuery({
  queryKey: ["ledger-balances", yearNum, monthNum],
  queryFn: () => fetchBalancesAction(yearNum, monthNum),
  initialData: balances, // use server-rendered data as initial
})
```

Then replace all references to the `balances` prop in the Balances tab with `currentBalances`.

Update the `balanceTotals` memo (~line 325) to use `currentBalances` instead of `balances`:

```typescript
const balanceTotals = useMemo(() => {
  return (currentBalances ?? []).reduce(
    (acc, b) => ({
      debit: acc.debit + b.debit_total,
      credit: acc.credit + b.credit_total,
      balance: acc.balance + b.balance,
    }),
    { debit: 0, credit: 0, balance: 0 }
  )
}, [currentBalances])
```

**Step 3: Verify**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

Test manually: Navigate to /ledger, switch to Balances tab, change year/month. The table should reload with new data.

**Step 4: Commit**

```bash
git add apps/web/src/lib/actions/ledger.ts apps/web/src/components/ledger/ledger-client.tsx
git commit -m "fix: make ledger balances tab year/month filter functional

Previously the year/month selectors updated local state but never
refetched data. Now uses TanStack Query + server action to refetch
balances when the period changes."
```

---

## Task 6: Encrypt OAuth Tokens at Rest

Gmail OAuth tokens are stored as plain text in the `email_connections` table.

**Files:**
- Create: `apps/web/src/lib/crypto.ts`
- Modify: `apps/web/src/components/settings/email-connection.tsx` (token storage/retrieval)
- Modify: `apps/web/src/lib/env.ts` (add ENCRYPTION_KEY env var)

**Step 1: Add encryption key to env**

Add to `.env.example`:
```
ENCRYPTION_KEY=   # 32-byte hex string for AES-256 encryption
```

Add to `apps/web/src/lib/env.ts` (inside the env validation schema):
```typescript
ENCRYPTION_KEY: z.string().length(64).optional(), // 32 bytes as hex
```

**Step 2: Create encryption utility**

Create: `apps/web/src/lib/crypto.ts`

```typescript
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto"

const ALGORITHM = "aes-256-gcm"
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Buffer {
  const hex = process.env.ENCRYPTION_KEY
  if (!hex) throw new Error("ENCRYPTION_KEY environment variable is required")
  return Buffer.from(hex, "hex")
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()])
  const tag = cipher.getAuthTag()
  // Format: base64(iv + tag + ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString("base64")
}

export function decrypt(encoded: string): string {
  const key = getKey()
  const buf = Buffer.from(encoded, "base64")
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext) + decipher.final("utf8")
}
```

**Step 3: Use encrypt/decrypt when storing/reading tokens**

Wherever OAuth tokens are written to `email_connections`, wrap with `encrypt()`. Wherever tokens are read for API calls, wrap with `decrypt()`. Search for all references to `access_token` and `refresh_token` in the codebase and update accordingly.

Key locations to update:
- The Gmail OAuth callback that stores tokens
- Any service that reads tokens to poll Gmail (likely in `apps/web/src/lib/services/` or Supabase Edge Functions)

**Step 4: Write a one-time migration script to encrypt existing tokens**

Create: `scripts/encrypt-existing-tokens.ts` (run manually once after deploying the encryption key)

```typescript
// Run with: npx tsx scripts/encrypt-existing-tokens.ts
import { createClient } from "@supabase/supabase-js"
import { encrypt } from "../apps/web/src/lib/crypto"

// ... fetch all email_connections, encrypt access_token and refresh_token, update rows
```

**Step 5: Verify**

Run: `cd apps/web && npx tsc --noEmit`
Expected: No type errors

**Step 6: Commit**

```bash
git add apps/web/src/lib/crypto.ts apps/web/src/lib/env.ts .env.example
git commit -m "feat: add AES-256-GCM encryption for OAuth tokens at rest

Tokens are encrypted before storage and decrypted on read.
Requires ENCRYPTION_KEY env var (32-byte hex string)."
```

---

## Verification Checklist (run after all tasks)

```bash
# Type check
cd apps/web && npx tsc --noEmit

# Build
cd apps/web && pnpm build

# Lint
cd apps/web && pnpm lint

# Migration check (if local Supabase is running)
cd supabase && supabase db push --local
```

Manual verification:
- [ ] Dashboard VAT widget shows correct numbers (not doubled)
- [ ] Invoices page shows pagination controls after 50+ rows
- [ ] Documents page shows pagination controls after 50+ rows
- [ ] Ledger balances tab year/month dropdown actually changes the displayed data
- [ ] No TypeScript errors, build succeeds
