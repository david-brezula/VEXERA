# Development Guide

This guide covers everything you need to work on Vexera day-to-day: running the project, understanding the codebase layout, and knowing how to add new features.

---

## Prerequisites

Install these before starting:

| Tool | Install | Version |
|---|---|---|
| Node.js | [nodejs.org](https://nodejs.org/) | 20+ |
| pnpm | `npm install -g pnpm` | 10+ |
| Supabase CLI | See below | 2.75+ |
| Git | [git-scm.com](https://git-scm.com/) | Any |

### Installing the Supabase CLI (Windows)

Download the binary from the [Supabase CLI releases page](https://github.com/supabase/cli/releases), place it somewhere on your `PATH`, or run:

```powershell
# Download to AppData
Invoke-WebRequest -Uri "https://github.com/supabase/cli/releases/latest/download/supabase_windows_amd64.exe" `
  -OutFile "$env:LOCALAPPDATA\supabase\supabase.exe"

# Add to PATH (restart terminal after)
setx PATH "$env:PATH;$env:LOCALAPPDATA\supabase"
```

Verify it works: `supabase --version`

---

## First-Time Setup

```bash
# 1. Install all dependencies
pnpm install

# 2. Copy the env template
cp apps/web/.env.example apps/web/.env.local

# 3. Fill in your Supabase credentials in apps/web/.env.local
# (Get them from: Supabase Dashboard → Project Settings → API)

# 4. Link the Supabase CLI to your project
supabase link --project-ref your-project-ref

# 5. Apply all database migrations
supabase db push

# 6. Start the dev server
pnpm dev
```

---

## Running the App

```bash
# From root — starts all apps (web, etc.)
pnpm dev

# Or just the web app
cd apps/web
pnpm dev
```

The app runs at [http://localhost:3000](http://localhost:3000).

---

## Available Scripts

Run these from the root of the monorepo:

```bash
pnpm dev              # Dev server (with Turbopack hot reload)
pnpm build            # Production build
pnpm type-check       # TypeScript check — no JS output, fast
pnpm lint             # ESLint across all packages
```

> **Use `pnpm type-check` instead of `pnpm build` during development.** The build command bakes environment variables into the output — if your `.env.local` is missing something, you'll get a corrupted `.next` cache.

### Clean the build cache

If the app behaves strangely after env changes:

```bash
rm -rf apps/web/.next
pnpm dev
```

---

## Project Layout (inside `apps/web/src`)

```
src/
├── app/                    # Pages and API routes (Next.js App Router)
│   ├── (auth)/             # Login/register pages (centered layout, no sidebar)
│   ├── (dashboard)/        # Protected pages (sidebar + header layout)
│   └── api/                # Backend API routes
│
├── components/
│   ├── layout/             # Sidebar, header, org switcher
│   └── ui/                 # shadcn/ui base components (don't edit these)
│
├── lib/
│   ├── supabase/           # Supabase client factories (browser, server, middleware)
│   ├── s3/                 # S3 client and key generation
│   ├── validations/        # Zod schemas for forms
│   ├── env.ts              # Validated environment variables
│   └── utils.ts            # `cn()` helper for Tailwind classes
│
├── providers/
│   ├── supabase-provider.tsx     # Auth state, Supabase client
│   ├── query-provider.tsx        # TanStack Query setup
│   └── organization-provider.tsx # Active org, org switcher logic
│
├── hooks/                  # Custom React hooks (add yours here)
└── middleware.ts            # Route protection (auth redirects)
```

---

## How to Add a New Page

### Step 1: Create the file

Pages live in `src/app/(dashboard)/`. Create a folder with the route name and a `page.tsx` inside:

```
src/app/(dashboard)/my-feature/page.tsx
```

URL will be: `/my-feature`

### Step 2: Write the page component

```tsx
// src/app/(dashboard)/my-feature/page.tsx
"use client"   // ← only needed if you use useState, useEffect, or browser APIs

import { useOrganization } from "@/providers/organization-provider"

export default function MyFeaturePage() {
  const { activeOrg } = useOrganization()

  if (!activeOrg) {
    return <p className="text-muted-foreground">No organization selected.</p>
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">My Feature</h1>
      <p>Organization: {activeOrg.name}</p>
    </div>
  )
}
```

### Step 3: Add it to the sidebar (optional)

In `src/components/layout/sidebar.tsx`, add an entry to `navItems`:

```typescript
const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/invoices", label: "Invoices", icon: FileText },
  // Add this:
  { href: "/my-feature", label: "My Feature", icon: SomeIcon },
]
```

Import the icon from `lucide-react` — [see all icons](https://lucide.dev/icons/).

---

## How to Fetch Data

### Reading data (useQuery)

```tsx
"use client"

import { useQuery } from "@tanstack/react-query"
import { useSupabase } from "@/providers/supabase-provider"
import { useOrganization } from "@/providers/organization-provider"

export default function InvoicesPage() {
  const { supabase } = useSupabase()
  const { activeOrg } = useOrganization()

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["invoices", activeOrg?.id],     // cache key — changes trigger refetch
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, status, total, due_date")
        .eq("organization_id", activeOrg!.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      return data
    },
    enabled: !!activeOrg,    // don't run until activeOrg is loaded
  })

  if (isLoading) return <p>Loading...</p>

  return (
    <ul>
      {invoices?.map((inv) => (
        <li key={inv.id}>{inv.invoice_number} — {inv.status}</li>
      ))}
    </ul>
  )
}
```

### Writing data (useMutation)

```tsx
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

const queryClient = useQueryClient()

const { mutate: createInvoice, isPending } = useMutation({
  mutationFn: async (values: { invoice_number: string; total: number }) => {
    const { error } = await supabase
      .from("invoices")
      .insert({
        ...values,
        organization_id: activeOrg!.id,
        invoice_type: "issued",
        status: "draft",
        // ... other required fields
      })
    if (error) throw error
  },
  onSuccess: () => {
    // Tell React Query to refetch the invoices list
    queryClient.invalidateQueries({ queryKey: ["invoices"] })
    toast.success("Invoice created!")
  },
  onError: (error) => {
    toast.error(error.message)
  },
})

// Then in your form:
// <Button onClick={() => createInvoice({ invoice_number: "2025-001", total: 120 })}>
//   Create
// </Button>
```

---

## How to Add a Form

Forms use **React Hook Form** + **Zod** for validation. Here's the pattern:

### Step 1: Define the schema

```typescript
// src/lib/validations/invoice.schema.ts
import { z } from "zod"

export const createInvoiceSchema = z.object({
  invoice_number: z.string().min(1, "Invoice number is required"),
  customer_name: z.string().min(2, "Customer name is required"),
  due_date: z.string().min(1, "Due date is required"),
  total: z.number().min(0, "Total must be positive"),
})

export type CreateInvoiceFormValues = z.infer<typeof createInvoiceSchema>
```

### Step 2: Use the form

```tsx
"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { createInvoiceSchema, type CreateInvoiceFormValues } from "@/lib/validations/invoice.schema"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

export function CreateInvoiceForm() {
  const form = useForm<CreateInvoiceFormValues>({
    resolver: zodResolver(createInvoiceSchema),
    defaultValues: {
      invoice_number: "",
      customer_name: "",
      due_date: "",
      total: 0,
    },
  })

  async function onSubmit(values: CreateInvoiceFormValues) {
    // values are already validated by Zod here
    console.log(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="invoice_number"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Invoice number</FormLabel>
              <FormControl>
                <Input placeholder="2025-001" {...field} />
              </FormControl>
              <FormMessage />   {/* shows Zod validation errors */}
            </FormItem>
          )}
        />
        <Button type="submit">Create invoice</Button>
      </form>
    </Form>
  )
}
```

---

## How to Add a Database Migration

1. Create a new file in `supabase/migrations/` with the next number:
   ```
   supabase/migrations/20240101000017_your_change.sql
   ```

2. Write idempotent SQL (safe to run multiple times):
   ```sql
   -- Use IF NOT EXISTS to avoid errors on re-run
   ALTER TABLE invoices ADD COLUMN IF NOT EXISTS pdf_generated BOOLEAN DEFAULT FALSE;
   ```

3. Push it:
   ```bash
   supabase db push
   ```

4. Regenerate TypeScript types:
   ```bash
   supabase gen types typescript --project-id your-project-ref > packages/types/src/database.types.ts
   ```

> **Important:** Never use `supabase db reset` in production — it drops all data.

---

## Using Shared Packages

### Types

```typescript
import type { InvoiceStatus, OrganizationRole, VatRate } from "@vexera/types"
import type { Database } from "@vexera/types"   // ← full DB types

// Use Database type with Supabase client for autocomplete
const supabase: SupabaseClient<Database> = ...
```

### Utils

```typescript
import { formatEur, calculateVatAmount, calculateGrossAmount } from "@vexera/utils"

formatEur(1234.56)              // → "1 234,56 €"
calculateVatAmount(100, 20)     // → 20
calculateGrossAmount(100, 20)   // → 120
```

---

## Code Conventions

### `"use client"` directive

Add `"use client"` at the top of a file only when you need:
- React hooks (`useState`, `useEffect`, `useQuery`, etc.)
- Browser APIs (`document`, `window`, `localStorage`)
- Event handlers (`onClick`, `onChange`)

Server Components (no directive) can't use any of the above, but they render faster.

### Tailwind classes with `cn()`

Use the `cn()` helper to conditionally combine Tailwind classes:

```typescript
import { cn } from "@/lib/utils"

<div className={cn(
  "rounded-md px-3 py-2",          // always applied
  isActive && "bg-accent",          // only when active
  disabled && "opacity-50",         // only when disabled
)} />
```

### Toast notifications

```typescript
import { toast } from "sonner"

toast.success("Saved!")
toast.error("Something went wrong")
toast.loading("Saving...")
```

### Absolute imports

Use `@/` to import from `src/`:

```typescript
import { Button } from "@/components/ui/button"    // good
import { Button } from "../../components/ui/button" // avoid
```

---

## TypeScript Tips

### Getting the type of a Supabase row

```typescript
import type { Database } from "@vexera/types"

type Invoice = Database["public"]["Tables"]["invoices"]["Row"]
type NewInvoice = Database["public"]["Tables"]["invoices"]["Insert"]
type UpdateInvoice = Database["public"]["Tables"]["invoices"]["Update"]
```

### Strict null safety

The project uses `strict: true`. Never cast with `as` unless absolutely necessary. Use proper null checks:

```typescript
// Bad — TypeScript will complain
const id = user.id as string

// Good
if (!user) return null
const id = user.id   // TypeScript knows it's a string here
```

---

## Common Errors and Fixes

### "Cannot read properties of null" on `activeOrg`

The `activeOrg` is `null` while organizations are still loading. Always guard:

```typescript
if (!activeOrg) return <p>Loading...</p>
// Now activeOrg is guaranteed to be non-null below
```

### 403 on Supabase query

Your RLS policy is blocking the request. Check:
1. Is the user logged in? (`user` from `useSupabase()`)
2. Does the user belong to the org? (check `organization_members`)
3. Is the policy correct? (check `supabase/migrations/014_rls_policies.sql`)

### 409 on Supabase insert

Either a unique constraint or FK constraint was violated:
- **Unique**: you're trying to insert a duplicate (check the `UNIQUE` constraint on the table)
- **FK**: a referenced row doesn't exist yet (e.g., the user's `profiles` row missing)

### TypeScript errors after deleting a file

Next.js caches type info in `.next/`. Clear it:

```bash
rm -rf apps/web/.next
pnpm type-check
```
