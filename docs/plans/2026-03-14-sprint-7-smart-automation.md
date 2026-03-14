# Sprint 7: Smart Automation — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enhance VEXERA's automation: rule engine OR logic + dropdowns + dry-run, OCR structured extraction UI, auto-categorization suggestion chips, recurring pattern detection from bank transactions, and a full chat/AI assistant page.

**Architecture:** Five independent feature slices built sequentially. Each extends existing backend services and adds/modifies UI components. All features are org-scoped with RLS.

**Tech Stack:** Next.js 15+ (App Router), Supabase (PostgreSQL + RLS), TypeScript, TanStack Query, shadcn/ui, Claude API (Anthropic SDK), React Hook Form + Zod.

**Verification:** After each task: `cd apps/web && npx tsc --noEmit` (type check). After all tasks: `npx pnpm build` (full build).

---

## Phase A: Rule Engine Improvements

### Task 1: Add OR logic to rule evaluation

**Files:**
- Modify: `packages/types/src/index.ts` — add `logic_operator` to `Rule` interface
- Modify: `apps/web/src/lib/services/rules-engine.service.ts` — update `evaluateRule()` to support OR
- Create: `supabase/migrations/20240101000052_rule_logic_operator.sql`

**Step 1: Migration**

Create `supabase/migrations/20240101000052_rule_logic_operator.sql`:

```sql
-- Add logic_operator to rules table (AND = all conditions must match, OR = any condition matches)
ALTER TABLE rules ADD COLUMN IF NOT EXISTS logic_operator TEXT NOT NULL DEFAULT 'AND';
ALTER TABLE rules ADD CONSTRAINT rules_logic_operator_check CHECK (logic_operator IN ('AND', 'OR'));
```

**Step 2: Update types**

In `packages/types/src/index.ts`, add `logic_operator` to the `Rule` interface:

```typescript
export interface Rule {
  id: string
  organization_id: string
  name: string
  description: string | null
  is_active: boolean
  priority: number
  target_entity: RuleTargetEntity
  conditions: RuleCondition[]
  actions: RuleAction[]
  logic_operator: 'AND' | 'OR'  // NEW
  applied_count: number
  last_applied_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}
```

**Step 3: Update evaluation logic**

In `apps/web/src/lib/services/rules-engine.service.ts`, modify `evaluateRule()`:

Replace:
```typescript
return rule.conditions.every((c) => evaluateCondition(c, target))
```

With:
```typescript
const op = rule.logic_operator ?? 'AND'
if (op === 'OR') {
  return rule.conditions.some((c) => evaluateCondition(c, target))
}
return rule.conditions.every((c) => evaluateCondition(c, target))
```

**Step 4: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 5: Commit** — `git add -A && git commit -m "feat(rules): add OR logic operator to rule evaluation"`

---

### Task 2: Add OR/AND toggle + dropdown values to rule form

**Files:**
- Modify: `apps/web/src/lib/validations/rule.schema.ts` — add `logic_operator` to schema
- Modify: `apps/web/src/components/rules/rule-form-dialog.tsx` — add AND/OR toggle, dropdown for action values
- Modify: `apps/web/src/app/api/rules/route.ts` — pass `logic_operator` on create
- Modify: `apps/web/src/app/api/rules/[id]/route.ts` — pass `logic_operator` on update

**Step 1: Update Zod schema**

In `rule.schema.ts`, add to `ruleFormSchema`:

```typescript
logic_operator: z.enum(["AND", "OR"]).default("AND"),
```

**Step 2: Update rule form dialog**

In `rule-form-dialog.tsx`:

1. Add `logic_operator` field with a `RadioGroup` (AND / OR) between conditions header and conditions list.
2. For action values where `type` is `set_category` or `set_account`, fetch options from API:
   - `set_category`: GET `/api/categorization/insights?organization_id={orgId}` to get existing categories, or query `chart_of_accounts` for account classes 5 (expenses) and 6 (revenue).
   - `set_account`: Fetch from `chart_of_accounts` via a new server action `getAccountOptionsAction()`.
3. Replace the free-text `value` input with a `Select` dropdown when action type is `set_category` or `set_account`. Keep free-text for `set_tag` and `set_document_type`.

Add a server action in `apps/web/src/lib/actions/rules.ts` (new file):

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"

export async function getAccountOptionsAction(): Promise<{ value: string; label: string }[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []

  const { data } = await supabase
    .from("chart_of_accounts")
    .select("account_number, name")
    .eq("organization_id", orgId)
    .order("account_number")

  return (data ?? []).map((a: any) => ({
    value: a.account_number,
    label: `${a.account_number} — ${a.name}`,
  }))
}

export async function getCategoryOptionsAction(): Promise<string[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []

  const { data } = await supabase
    .from("documents")
    .select("category")
    .eq("organization_id", orgId)
    .not("category", "is", null)

  const unique = [...new Set((data ?? []).map((d: any) => d.category as string))]
  return unique.sort()
}
```

**Step 3: Update API routes**

In `apps/web/src/app/api/rules/route.ts` POST handler, include `logic_operator` in the insert payload.

In `apps/web/src/app/api/rules/[id]/route.ts` PATCH handler, allow `logic_operator` in the update payload.

**Step 4: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 5: Commit** — `git add -A && git commit -m "feat(rules): add AND/OR toggle and dropdown values to rule form"`

---

### Task 3: Rule dry-run / test mode

**Files:**
- Create: `apps/web/src/lib/actions/rules.ts` — add `testRuleAction()` (append to file from Task 2)
- Modify: `apps/web/src/components/rules/rule-form-dialog.tsx` — add "Test Rule" button and preview table

**Step 1: Server action for dry-run**

Add to `apps/web/src/lib/actions/rules.ts`:

```typescript
export async function testRuleAction(rule: {
  target_entity: string
  conditions: { field: string; operator: string; value: string | number }[]
  logic_operator: string
  actions: { type: string; value: string }[]
}): Promise<{
  matches: { id: string; description: string; amount: number | null; date: string | null; actions: Record<string, string> }[]
  total: number
}> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { matches: [], total: 0 }

  const table = rule.target_entity === "document" ? "documents" : "bank_transactions"
  const { data } = await supabase
    .from(table)
    .select("*")
    .eq("organization_id", orgId)
    .limit(100)

  if (!data) return { matches: [], total: 0 }

  // Import evaluation functions
  const { evaluateCondition } = await import("@/lib/services/rules-engine.service")

  const matches: typeof result.matches = []

  for (const entity of data) {
    const target: Record<string, string | number | null> = {}
    for (const key of Object.keys(entity)) {
      target[key] = (entity as any)[key]
    }

    const op = rule.logic_operator ?? "AND"
    const conditionsMet = op === "OR"
      ? rule.conditions.some((c: any) => evaluateCondition(c, target))
      : rule.conditions.every((c: any) => evaluateCondition(c, target))

    if (conditionsMet) {
      const actions: Record<string, string> = {}
      for (const action of rule.actions) {
        const colMap: Record<string, string> = {
          set_category: "category",
          set_account: "account_number",
          set_document_type: "document_type",
          set_tag: "tag",
        }
        const col = colMap[action.type]
        if (col) actions[col] = action.value
      }

      matches.push({
        id: (entity as any).id,
        description: (entity as any).description ?? (entity as any).name ?? "—",
        amount: (entity as any).total_amount ?? (entity as any).amount ?? null,
        date: (entity as any).issue_date ?? (entity as any).transaction_date ?? null,
        actions,
      })
    }
  }

  return { matches, total: matches.length }
}
```

Note: You'll need to export `evaluateCondition` from `rules-engine.service.ts` (currently it's a private function). Add `export` keyword to it.

**Step 2: Update rule form dialog**

Add a "Test Rule" button below the form. When clicked:
1. Call `testRuleAction()` with current form values.
2. Show results in a collapsible panel with a table: Description, Amount, Date, Actions to Apply.
3. Show "X matches found" summary.

Use `useTransition` for the loading state.

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(rules): add dry-run test mode with match preview"`

---

## Phase B: OCR Structured Extraction UI

### Task 4: OCR extraction review component

**Files:**
- Create: `apps/web/src/components/documents/ocr-extraction-review.tsx`
- Modify: `apps/web/src/components/documents/document-detail-client.tsx` — replace raw JSON with new component

**Step 1: Create the extraction review component**

Create `apps/web/src/components/documents/ocr-extraction-review.tsx`:

A client component that:
1. Takes props: `documentId: string`, `ocrData: OcrExtractedFields`, `onInvoiceCreated?: (invoiceId: string) => void`
2. Renders a form with labeled inputs for each extracted field:
   - supplier_name, document_number, issue_date, due_date, total_amount, vat_amount, vat_rate, currency, iban, variable_symbol
3. Each field shows a confidence indicator dot:
   - Green (`bg-green-500`): field has a non-null value
   - Red (`bg-red-500`): field is null/empty (user should fill)
4. All fields are editable via `useState` initialized from `ocrData`
5. Two action buttons at the bottom:
   - "Accept & Create Invoice" — calls `createInvoiceFromOcrAction()` (Task 5)
   - "Edit in Full Form" — saves to sessionStorage key `ocr-prefill-{documentId}` and navigates to `/invoices/new`

Use shadcn `Input`, `Label`, `Button`, `Card`, `CardHeader`, `CardContent`.

**Step 2: Integrate into document detail page**

In `document-detail-client.tsx`, find the "OCR Data" tab that shows raw JSON. Replace/augment it:
- If `ocr_status === "done"` and `ocr_data` exists, render `<OcrExtractionReview>` instead of raw JSON.
- Keep a "Show Raw JSON" toggle for debugging.

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(ocr): structured extraction review UI with confidence indicators"`

---

### Task 5: Create invoice from OCR action + prefill support

**Files:**
- Create: `apps/web/src/lib/actions/ocr.ts` — `createInvoiceFromOcrAction()`
- Modify: `apps/web/src/app/(dashboard)/invoices/new/page.tsx` or the invoice form — read sessionStorage prefill

**Step 1: Server action**

Create `apps/web/src/lib/actions/ocr.ts`:

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { revalidatePath } from "next/cache"

interface OcrInvoiceInput {
  documentId: string
  supplierName: string
  documentNumber: string | null
  issueDate: string | null
  dueDate: string | null
  totalAmount: number | null
  vatAmount: number | null
  vatRate: number | null
  currency: string | null
  iban: string | null
  variableSymbol: string | null
}

export async function createInvoiceFromOcrAction(
  input: OcrInvoiceInput
): Promise<{ invoiceId?: string; error?: string }> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  const invoiceId = crypto.randomUUID()
  const totalNet = input.totalAmount && input.vatAmount
    ? input.totalAmount - input.vatAmount
    : input.totalAmount ?? 0

  const { error: invoiceError } = await (supabase.from("invoices" as any) as any)
    .insert({
      id: invoiceId,
      organization_id: orgId,
      invoice_type: "received",
      status: "draft",
      customer_name: input.supplierName,
      invoice_number: input.documentNumber,
      issue_date: input.issueDate ?? new Date().toISOString().split("T")[0],
      due_date: input.dueDate,
      total_amount: input.totalAmount,
      vat_amount: input.vatAmount,
      currency: input.currency ?? "EUR",
      variable_symbol: input.variableSymbol,
      bank_iban: input.iban,
    })

  if (invoiceError) return { error: invoiceError.message }

  // Link document to invoice
  await (supabase.from("documents" as any) as any)
    .update({ invoice_id: invoiceId })
    .eq("id", input.documentId)

  // Create a single line item with the total
  if (input.totalAmount) {
    await (supabase.from("invoice_items" as any) as any)
      .insert({
        invoice_id: invoiceId,
        description: "Imported from OCR",
        quantity: 1,
        unit: "ks",
        unit_price: totalNet,
        vat_rate: input.vatRate ?? 20,
        total_price: input.totalAmount,
        sort_order: 0,
      })
  }

  revalidatePath("/invoices")
  revalidatePath(`/documents`)
  return { invoiceId }
}
```

**Step 2: Prefill invoice form from sessionStorage**

In the invoice creation form component (find the `new` invoice page or `invoice-form.tsx`), on mount check for `sessionStorage.getItem("ocr-prefill-{id}")`. If present, parse and populate form defaults, then remove the key.

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(ocr): create invoice from OCR extraction + form prefill"`

---

## Phase C: Auto-Categorization Suggestions

### Task 6: Category suggestions component

**Files:**
- Create: `apps/web/src/components/shared/category-suggestions.tsx`
- Create: `apps/web/src/lib/actions/categorization.ts` — server actions for suggestions

**Step 1: Server actions**

Create `apps/web/src/lib/actions/categorization.ts`:

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { suggestCategory, recordCorrection } from "@/lib/services/categorization.service"
import type { SuggestionInput, CategorySuggestion } from "@/lib/services/categorization.service"

export async function getSuggestionsAction(
  input: SuggestionInput
): Promise<CategorySuggestion[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []

  // Get top 3 suggestions by calling the service with different strategies
  const suggestions: CategorySuggestion[] = []

  // Primary suggestion from full scoring
  const primary = await suggestCategory(supabase, orgId, input)
  if (primary) suggestions.push(primary)

  // Supplier-only suggestion if different
  if (input.supplier_name) {
    const { suggestCategoryBySupplier } = await import("@/lib/services/categorization.service")
    const bySupplier = await suggestCategoryBySupplier(supabase, orgId, input.supplier_name)
    if (bySupplier && !suggestions.find(s => s.category === bySupplier.category)) {
      suggestions.push(bySupplier)
    }
  }

  return suggestions.slice(0, 3)
}

export async function acceptSuggestionAction(
  documentId: string,
  category: string,
  accountNumber: string
): Promise<{ error?: string }> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  // Update document
  const { error } = await (supabase.from("documents" as any) as any)
    .update({
      category,
      account_number: accountNumber,
      auto_categorized: true,
    })
    .eq("id", documentId)

  if (error) return { error: error.message }

  // Record as correction for ML feedback
  await recordCorrection(supabase, orgId, {
    documentId,
    userId: "", // will be filled by service
    fieldName: "category",
    oldValue: null,
    newValue: category,
    source: "manual",
  })

  return {}
}

export async function dismissSuggestionAction(
  documentId: string,
  category: string
): Promise<void> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return

  // Record dismissal as negative feedback
  await recordCorrection(supabase, orgId, {
    documentId,
    userId: "",
    fieldName: "category",
    oldValue: category,
    newValue: "__dismissed__",
    source: "manual",
  })
}
```

**Step 2: Create CategorySuggestions component**

Create `apps/web/src/components/shared/category-suggestions.tsx`:

```typescript
"use client"

import { useEffect, useState, useTransition } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { XIcon, CheckIcon, SparklesIcon } from "lucide-react"
import { getSuggestionsAction, acceptSuggestionAction, dismissSuggestionAction } from "@/lib/actions/categorization"

interface CategorySuggestionsProps {
  documentId: string
  supplierName: string | null
  totalAmount: number | null
  description: string | null
  onAccepted?: (category: string) => void
}

export function CategorySuggestions({ documentId, supplierName, totalAmount, description, onAccepted }: CategorySuggestionsProps) {
  const [suggestions, setSuggestions] = useState<{ category: string; account_number: string; confidence: number }[]>([])
  const [isPending, startTransition] = useTransition()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  useEffect(() => {
    startTransition(async () => {
      const result = await getSuggestionsAction({
        supplier_name: supplierName,
        total_amount: totalAmount,
        description,
      })
      setSuggestions(result)
    })
  }, [supplierName, totalAmount, description])

  const handleAccept = (s: typeof suggestions[0]) => {
    startTransition(async () => {
      const result = await acceptSuggestionAction(documentId, s.category, s.account_number)
      if (!result.error) onAccepted?.(s.category)
    })
  }

  const handleDismiss = (s: typeof suggestions[0]) => {
    setDismissed(prev => new Set(prev).add(s.category))
    dismissSuggestionAction(documentId, s.category)
  }

  const visible = suggestions.filter(s => !dismissed.has(s.category))
  if (visible.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <SparklesIcon className="size-4 text-muted-foreground" />
      <span className="text-xs text-muted-foreground">Suggestions:</span>
      {visible.map((s) => (
        <Badge
          key={s.category}
          variant="outline"
          className="cursor-pointer hover:bg-accent gap-1 pr-1"
        >
          <button onClick={() => handleAccept(s)} className="flex items-center gap-1">
            <CheckIcon className="size-3" />
            {s.category} ({Math.round(s.confidence * 100)}%)
          </button>
          <button onClick={() => handleDismiss(s)} className="ml-1 hover:text-destructive">
            <XIcon className="size-3" />
          </button>
        </Badge>
      ))}
    </div>
  )
}
```

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(categorization): category suggestion chips component with accept/dismiss"`

---

### Task 7: Integrate suggestions into document detail + bank transactions

**Files:**
- Modify: `apps/web/src/components/documents/document-detail-client.tsx` — add suggestions below category field
- Modify: `apps/web/src/components/bank/bank-transactions-table.tsx` — add inline suggestion for unmatched rows

**Step 1: Document detail integration**

In `document-detail-client.tsx`, find the extracted fields card where `category` is displayed. Below the category field (or where category would be if null), add:

```tsx
{!document.category && document.ocr_status === "done" && (
  <CategorySuggestions
    documentId={document.id}
    supplierName={document.supplier_name}
    totalAmount={document.total_amount}
    description={document.name}
    onAccepted={() => router.refresh()}
  />
)}
```

**Step 2: Bank transactions integration**

In `bank-transactions-table.tsx`, for rows where `match_status === "unmatched"`, add a small `CategorySuggestions` component in the row or as an expandable section. Since bank transactions don't have `documentId`, create a lightweight variant that just shows the suggestion text without accept/dismiss (informational only for transactions — the action is to create a rule).

Alternative: Add a small text hint in the description cell: "Looks like: Office Supplies (85%)" using the suggestion service directly.

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(categorization): integrate suggestions into document detail and bank transactions"`

---

## Phase D: Recurring Pattern Detection

### Task 8: Pattern detection algorithm + migration

**Files:**
- Create: `apps/web/src/lib/services/pattern-detection.service.ts`
- Create: `supabase/migrations/20240101000053_dismissed_patterns.sql`
- Create: `apps/web/src/lib/actions/patterns.ts`

**Step 1: Migration**

Create `supabase/migrations/20240101000053_dismissed_patterns.sql`:

```sql
-- Store dismissed recurring pattern hashes so they don't resurface
ALTER TABLE organizations ADD COLUMN IF NOT EXISTS dismissed_recurring_patterns JSONB DEFAULT '[]'::jsonb;
```

**Step 2: Pattern detection service**

Create `apps/web/src/lib/services/pattern-detection.service.ts`:

```typescript
import type { SupabaseClient } from "@supabase/supabase-js"

export interface DetectedPattern {
  id: string  // hash of counterparty + rounded amount
  counterpartyName: string
  counterpartyIban: string | null
  averageAmount: number
  frequency: "weekly" | "monthly" | "quarterly"
  confidence: number
  matchCount: number
  lastOccurrence: string
  transactionIds: string[]
}

export async function detectRecurringPatterns(
  supabase: SupabaseClient,
  organizationId: string
): Promise<DetectedPattern[]> {
  // Fetch last 12 months of transactions
  const twelveMonthsAgo = new Date()
  twelveMonthsAgo.setFullYear(twelveMonthsAgo.getFullYear() - 1)

  const { data: transactions } = await supabase
    .from("bank_transactions")
    .select("id, transaction_date, amount, counterpart_name, counterpart_iban, description")
    .eq("organization_id", organizationId)
    .gte("transaction_date", twelveMonthsAgo.toISOString().split("T")[0])
    .order("transaction_date", { ascending: true })

  if (!transactions || transactions.length < 3) return []

  // Fetch dismissed patterns
  const { data: org } = await supabase
    .from("organizations")
    .select("dismissed_recurring_patterns")
    .eq("id", organizationId)
    .single()

  const dismissed = new Set(
    ((org as any)?.dismissed_recurring_patterns ?? []) as string[]
  )

  // Group by counterparty name (normalized)
  const groups = new Map<string, typeof transactions>()
  for (const tx of transactions) {
    const key = ((tx as any).counterpart_name ?? "").toLowerCase().trim()
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(tx)
  }

  const patterns: DetectedPattern[] = []

  for (const [, txs] of groups) {
    if (txs.length < 3) continue

    // Check amount consistency (within 5% of median)
    const amounts = txs.map((t: any) => Math.abs(Number(t.amount)))
    amounts.sort((a, b) => a - b)
    const median = amounts[Math.floor(amounts.length / 2)]
    const consistent = amounts.filter(a => Math.abs(a - median) / median <= 0.05)
    if (consistent.length < 3) continue

    // Check interval regularity
    const dates = txs.map((t: any) => new Date(t.transaction_date).getTime()).sort()
    const intervals: number[] = []
    for (let i = 1; i < dates.length; i++) {
      intervals.push((dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24))
    }
    const avgInterval = intervals.reduce((a, b) => a + b, 0) / intervals.length

    let frequency: "weekly" | "monthly" | "quarterly" | null = null
    if (avgInterval >= 5 && avgInterval <= 10) frequency = "weekly"
    else if (avgInterval >= 25 && avgInterval <= 35) frequency = "monthly"
    else if (avgInterval >= 80 && avgInterval <= 100) frequency = "quarterly"

    if (!frequency) continue

    // Calculate confidence
    const intervalVariance = intervals.reduce((sum, i) => sum + Math.abs(i - avgInterval), 0) / intervals.length
    const intervalScore = Math.max(0, 1 - intervalVariance / avgInterval)
    const amountScore = consistent.length / amounts.length
    const countScore = Math.min(txs.length / 6, 1)
    const confidence = (intervalScore * 0.4 + amountScore * 0.3 + countScore * 0.3)

    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const id = hashPattern((txs[0] as any).counterpart_name, Math.round(avg))

    if (dismissed.has(id)) continue

    patterns.push({
      id,
      counterpartyName: (txs[0] as any).counterpart_name,
      counterpartyIban: (txs[0] as any).counterpart_iban ?? null,
      averageAmount: Math.round(avg * 100) / 100,
      frequency,
      confidence: Math.round(confidence * 100) / 100,
      matchCount: txs.length,
      lastOccurrence: (txs[txs.length - 1] as any).transaction_date,
      transactionIds: txs.map((t: any) => t.id),
    })
  }

  return patterns.sort((a, b) => b.confidence - a.confidence)
}

function hashPattern(name: string, amount: number): string {
  const str = `${name.toLowerCase().trim()}:${amount}`
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return `pat_${Math.abs(hash).toString(36)}`
}
```

**Step 3: Server actions**

Create `apps/web/src/lib/actions/patterns.ts`:

```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { detectRecurringPatterns } from "@/lib/services/pattern-detection.service"
import type { DetectedPattern } from "@/lib/services/pattern-detection.service"

export async function getDetectedPatternsAction(): Promise<DetectedPattern[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []
  return detectRecurringPatterns(supabase, orgId)
}

export async function dismissPatternAction(patternId: string): Promise<{ error?: string }> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return { error: "No active organization" }

  // Fetch current dismissed list
  const { data: org } = await supabase
    .from("organizations")
    .select("dismissed_recurring_patterns")
    .eq("id", orgId)
    .single()

  const current = ((org as any)?.dismissed_recurring_patterns ?? []) as string[]
  if (current.includes(patternId)) return {}

  const { error } = await (supabase.from("organizations" as any) as any)
    .update({
      dismissed_recurring_patterns: [...current, patternId],
    })
    .eq("id", orgId)

  if (error) return { error: error.message }
  return {}
}

export async function getPatternCountAction(): Promise<number> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return 0
  const patterns = await detectRecurringPatterns(supabase, orgId)
  return patterns.length
}
```

**Step 4: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 5: Commit** — `git add -A && git commit -m "feat(patterns): recurring pattern detection algorithm and server actions"`

---

### Task 9: Pattern review UI + sidebar badge

**Files:**
- Create: `apps/web/src/components/bank/recurring-patterns-panel.tsx`
- Modify: `apps/web/src/components/bank/bank-page-client.tsx` — add Patterns tab
- Modify: `apps/web/src/components/layout/sidebar.tsx` — add badge to Bank nav item

**Step 1: Patterns panel component**

Create `apps/web/src/components/bank/recurring-patterns-panel.tsx`:

A client component that:
1. Calls `getDetectedPatternsAction()` on mount via `useEffect` + `useTransition`.
2. Renders each pattern as a `Card`:
   - Counterparty name (bold), IBAN (if available, muted)
   - Average amount formatted as EUR
   - Frequency badge: "Monthly", "Weekly", "Quarterly"
   - Match count: "Based on X transactions"
   - Last occurrence date
   - Confidence as a small progress bar or percentage
3. Two buttons per card:
   - "Create Recurring Template" → navigates to `/invoices/recurring?prefill={base64 encoded JSON}` with `customerName`, `amount`, `frequency` pre-filled
   - "Dismiss" → calls `dismissPatternAction()`, removes card from list
4. Empty state: "No recurring patterns detected yet. Import more bank transactions to enable detection."

**Step 2: Add Patterns tab to bank page**

In `bank-page-client.tsx`, add a new tab "Patterns" after "Reconcile". Render `<RecurringPatternsPanel />` inside it. Add a badge to the tab trigger showing the count.

**Step 3: Sidebar badge**

In `sidebar.tsx`, extend the nav item type to support an optional `badge` count. For the Bank nav item, fetch the pattern count via a client-side effect or pass it as a prop from a layout component.

Simple approach: Create a small `BankNavBadge` client component that calls `getPatternCountAction()` and renders a badge if > 0. Render it next to the "Bank" label in the sidebar.

**Step 4: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 5: Commit** — `git add -A && git commit -m "feat(patterns): recurring patterns review panel with sidebar badge"`

---

## Phase E: Chat/AI Assistant

### Task 10: Chat page and layout

**Files:**
- Create: `apps/web/src/app/(dashboard)/chat/page.tsx`
- Modify: `apps/web/src/components/layout/sidebar.tsx` — add Chat nav link

**Step 1: Create chat page**

Create `apps/web/src/app/(dashboard)/chat/page.tsx`:

```typescript
import { ChatInterface } from "@/components/chat/chat-interface"

export default function ChatPage() {
  return (
    <div className="h-[calc(100vh-4rem)]">
      <ChatInterface />
    </div>
  )
}
```

**Step 2: Add to sidebar**

In `sidebar.tsx`, add a Chat nav item to the "Main" group:

```typescript
{ href: "/chat", label: "AI Assistant", icon: MessageSquare },
```

Import `MessageSquare` from `lucide-react`.

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(chat): add chat page route and sidebar navigation"`

---

### Task 11: Chat interface component with streaming

**Files:**
- Create: `apps/web/src/components/chat/chat-interface.tsx`
- Modify: `apps/web/src/app/api/chat/route.ts` — add streaming support

**Step 1: Update API route for streaming**

Modify `apps/web/src/app/api/chat/route.ts` to support streaming:

Add a new streaming endpoint. Keep the existing non-streaming POST, but add streaming behavior when `Accept: text/event-stream` header is present. Or simpler: add a `stream: true` flag in the request body.

When streaming:
1. Build the same system prompt + messages as the non-streaming version.
2. Use `fetch` to the Anthropic API with `stream: true`.
3. Return a `ReadableStream` response that forwards SSE chunks.
4. After stream completes, save the full message to the database.

```typescript
// In the POST handler, after building messages:
if (body.stream) {
  const anthropicResponse = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-6",
      max_tokens: 1024,
      system: systemPrompt,
      messages: conversationMessages,
      stream: true,
    }),
  })

  // Create a TransformStream that collects full text for saving
  let fullText = ""
  const stream = new ReadableStream({
    async start(controller) {
      const reader = anthropicResponse.body!.getReader()
      const decoder = new TextDecoder()
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          controller.enqueue(new TextEncoder().encode(chunk))

          // Parse SSE to collect text
          for (const line of chunk.split("\n")) {
            if (line.startsWith("data: ")) {
              try {
                const data = JSON.parse(line.slice(6))
                if (data.type === "content_block_delta" && data.delta?.text) {
                  fullText += data.delta.text
                }
              } catch {}
            }
          }
        }
      } finally {
        controller.close()
        // Save complete message to DB
        await saveMessage(supabase, sessionId, "assistant", fullText, { model: "claude-sonnet-4-6", streamed: true })
      }
    },
  })

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
  })
}
```

**Step 2: Create ChatInterface component**

Create `apps/web/src/components/chat/chat-interface.tsx`:

A client component with:
1. **State:** `messages: { role, content }[]`, `sessionId`, `isStreaming`, `input`
2. **Session sidebar:** Left panel (collapsible on mobile) with list of past sessions from `useChatSessions()`. Each clickable to load. "New Chat" button.
3. **Message area:** Scrollable div showing messages. User messages on right (bg-primary text-primary-foreground), assistant on left (bg-muted). Assistant messages rendered with markdown (use a simple `prose` class or a lightweight markdown renderer).
4. **Input bar:** Fixed at bottom. Textarea + Send button. Shift+Enter for newline, Enter to send.
5. **Streaming:** When sending, use `fetch` with `stream: true`, read the SSE response incrementally, and append text to the last assistant message in real-time.
6. **Empty state:** Show suggestion chips from existing `chat-suggestion-chips.tsx`. Clicking one sends that message.
7. **Loading state:** Show a typing indicator (three dots animation) while waiting for first chunk.

Use existing components: `ChatMessage`, `ChatInput`, `ChatSuggestionChips` from `components/chat/`.

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(chat): full chat interface with streaming and session management"`

---

### Task 12: Context-aware chat enhancements

**Files:**
- Modify: `apps/web/src/lib/services/ai-chat.service.ts` — enhance `buildOrgContext()` and `fetchRelevantData()`
- Modify: `apps/web/src/components/chat/chat-interface.tsx` — pass page context

**Step 1: Enhance context building**

In `ai-chat.service.ts`, enhance `buildOrgContext()` to include:
- Outstanding AR total (sum of unpaid issued invoices)
- Outstanding AP total (sum of unpaid received invoices)
- This month's expenses total
- Unmatched bank transaction count

Add to `fetchRelevantData()`:
- Pattern: "bank" or "transakci" → fetch recent unmatched transactions summary
- Pattern: "pattern" or "opakuj" or "recurring" → run pattern detection and include results

**Step 2: Page context support**

In `chat-interface.tsx`, accept an optional `pageContext` prop:

```typescript
interface ChatInterfaceProps {
  pageContext?: {
    type: "invoice" | "document" | "transaction"
    id: string
    summary: string
  }
}
```

When sending a message, if `pageContext` is set, prepend it to the first message: `"[Context: viewing ${pageContext.type} — ${pageContext.summary}]\n\n${userMessage}"`.

This allows future integration where opening chat from an invoice page passes that invoice's details.

**Step 3: Verify** — `cd apps/web && npx tsc --noEmit`

**Step 4: Commit** — `git add -A && git commit -m "feat(chat): enhanced org context with AR/AP totals and page-aware context"`

---

## Verification

After all tasks:

```bash
cd apps/web && npx tsc --noEmit     # Type check
cd apps/web && npx pnpm build       # Full build
cd apps/web && npx pnpm lint        # Lint check
```

Fix any errors before marking Sprint 7 complete.
