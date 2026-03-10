# Role-Based Onboarding & Organization Types Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add organization type selection (Živnostník / Firma / Účtovník) to onboarding, create type-specific DB profile tables, add Slovak tax calculation utilities, and conditionally route the dashboard based on org type.

**Architecture:** Add `organization_type` column to `organizations`, link type-specific profile tables (`freelancer_profiles`, `company_profiles`, `accounting_firm_profiles`). The existing `accountant_clients` table already handles accountant→client connections. Rework the existing 5-step onboarding wizard to prepend a type-selection step and branch fields based on type. Dashboard routes to type-specific content.

**Tech Stack:** Next.js 16 App Router, TypeScript 5 strict, Supabase PostgreSQL + RLS, React Hook Form + Zod, TanStack Query, shadcn/ui (Card, Form, Select, Button, Badge), Lucide icons, `@vexera/types`, `@vexera/utils`

---

## Codebase Map (read before touching anything)

| File | Role |
|---|---|
| `supabase/migrations/20240101000027_fix_handle_new_user.sql` | Last migration — next is 000028 |
| `packages/types/src/index.ts` | Domain types — add org type enums here |
| `packages/types/src/database.types.ts` | DB table types — add new table rows here |
| `packages/utils/src/index.ts` | Exports — add tax export here |
| `packages/utils/src/vat.ts` | Existing VAT utils — reference for style |
| `apps/web/src/providers/organization-provider.tsx` | Fetches orgs + exposes `activeOrg` — add `organization_type` to type + query |
| `apps/web/src/middleware.ts` | Auth redirect — add onboarding redirect here |
| `apps/web/src/components/onboarding/onboarding-wizard.tsx` | Full 5-step wizard — prepend type-selection step |
| `apps/web/src/app/(dashboard)/onboarding/page.tsx` | Onboarding page — already exists in dashboard group |
| `apps/web/src/app/(dashboard)/page.tsx` | Main dashboard — add org-type routing here |
| `apps/web/src/app/(dashboard)/accountant/page.tsx` | Accountant dashboard page — already built |
| `apps/web/src/components/dashboard/accountant-dashboard.tsx` | Accountant dashboard UI — add referral link section |
| `apps/web/src/app/(dashboard)/layout.tsx` | Dashboard layout — may need updating |
| `apps/web/src/lib/data/org.ts` | `getActiveOrgId()` — check if org type is fetched here |

---

## Task 1: DB Migration — Organization Types & Profile Tables

**Files:**
- Create: `supabase/migrations/20240101000028_organization_types.sql`

**Step 1: Write the migration**

```sql
-- supabase/migrations/20240101000028_organization_types.sql

-- 1. Add organization_type column
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS organization_type TEXT NOT NULL DEFAULT 'freelancer'
    CHECK (organization_type IN ('freelancer', 'company', 'accounting_firm'));

CREATE INDEX IF NOT EXISTS idx_organizations_type ON organizations(organization_type);

-- 2. freelancer_profiles
CREATE TABLE IF NOT EXISTS freelancer_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  ico              TEXT,
  tax_regime       TEXT NOT NULL DEFAULT 'pausalne_vydavky'
                     CHECK (tax_regime IN ('pausalne_vydavky', 'naklady')),
  registered_dph   BOOLEAN NOT NULL DEFAULT false,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. company_profiles
CREATE TABLE IF NOT EXISTS company_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  ico              TEXT,
  ic_dph           TEXT,
  dph_status       TEXT NOT NULL DEFAULT 'neplatca'
                     CHECK (dph_status IN ('platca', 'neplatca')),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. accounting_firm_profiles
CREATE TABLE IF NOT EXISTS accounting_firm_profiles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id  UUID NOT NULL UNIQUE REFERENCES organizations(id) ON DELETE CASCADE,
  referral_code    TEXT NOT NULL UNIQUE DEFAULT substr(md5(gen_random_uuid()::text), 1, 10),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 5. RLS for freelancer_profiles
ALTER TABLE freelancer_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "freelancer_profiles_select" ON freelancer_profiles;
CREATE POLICY "freelancer_profiles_select" ON freelancer_profiles FOR SELECT
  USING (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "freelancer_profiles_insert" ON freelancer_profiles;
CREATE POLICY "freelancer_profiles_insert" ON freelancer_profiles FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "freelancer_profiles_update" ON freelancer_profiles;
CREATE POLICY "freelancer_profiles_update" ON freelancer_profiles FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));

-- 6. RLS for company_profiles
ALTER TABLE company_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "company_profiles_select" ON company_profiles;
CREATE POLICY "company_profiles_select" ON company_profiles FOR SELECT
  USING (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "company_profiles_insert" ON company_profiles;
CREATE POLICY "company_profiles_insert" ON company_profiles FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "company_profiles_update" ON company_profiles;
CREATE POLICY "company_profiles_update" ON company_profiles FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));

-- 7. RLS for accounting_firm_profiles
ALTER TABLE accounting_firm_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "accounting_firm_profiles_select" ON accounting_firm_profiles;
CREATE POLICY "accounting_firm_profiles_select" ON accounting_firm_profiles FOR SELECT
  USING (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "accounting_firm_profiles_insert" ON accounting_firm_profiles;
CREATE POLICY "accounting_firm_profiles_insert" ON accounting_firm_profiles FOR INSERT
  WITH CHECK (organization_id = ANY(get_user_organization_ids()));

DROP POLICY IF EXISTS "accounting_firm_profiles_update" ON accounting_firm_profiles;
CREATE POLICY "accounting_firm_profiles_update" ON accounting_firm_profiles FOR UPDATE
  USING (organization_id = ANY(get_user_organization_ids()));
```

**Step 2: Push migration to Supabase**

Run (from repo root): `supabase db push`

Expected: All 3 new tables created, `organization_type` column added to `organizations`.

**Step 3: Verify in Supabase dashboard**

Open Supabase → Table Editor → confirm `freelancer_profiles`, `company_profiles`, `accounting_firm_profiles` exist, and `organizations` has `organization_type` column.

**Step 4: Commit**

```bash
git add supabase/migrations/20240101000028_organization_types.sql
git commit -m "feat(db): add organization_type and profile tables"
```

---

## Task 2: Update Shared Types

**Files:**
- Modify: `packages/types/src/index.ts`
- Modify: `packages/types/src/database.types.ts`

**Step 1: Add domain types to `packages/types/src/index.ts`**

Add after the `AccountantClientStatus` line (line 39):

```typescript
export type OrganizationType = 'freelancer' | 'company' | 'accounting_firm'
export type TaxRegime = 'pausalne_vydavky' | 'naklady'
export type DphStatus = 'platca' | 'neplatca'

export interface FreelancerProfile {
  id: string
  organization_id: string
  ico: string | null
  tax_regime: TaxRegime
  registered_dph: boolean
  created_at: string
}

export interface CompanyProfile {
  id: string
  organization_id: string
  ico: string | null
  ic_dph: string | null
  dph_status: DphStatus
  created_at: string
}

export interface AccountingFirmProfile {
  id: string
  organization_id: string
  referral_code: string
  created_at: string
}
```

**Step 2: Add new tables to `packages/types/src/database.types.ts`**

After the `accountant_clients` table row (after line ~212), add:

```typescript
      freelancer_profiles: {
        Row: {
          id: string
          organization_id: string
          ico: string | null
          tax_regime: string
          registered_dph: boolean
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          ico?: string | null
          tax_regime: string
          registered_dph?: boolean
          created_at?: string
        }
        Update: {
          ico?: string | null
          tax_regime?: string
          registered_dph?: boolean
        }
        Relationships: []
      }
      company_profiles: {
        Row: {
          id: string
          organization_id: string
          ico: string | null
          ic_dph: string | null
          dph_status: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          ico?: string | null
          ic_dph?: string | null
          dph_status: string
          created_at?: string
        }
        Update: {
          ico?: string | null
          ic_dph?: string | null
          dph_status?: string
        }
        Relationships: []
      }
      accounting_firm_profiles: {
        Row: {
          id: string
          organization_id: string
          referral_code: string
          created_at: string
        }
        Insert: {
          id?: string
          organization_id: string
          referral_code?: string
          created_at?: string
        }
        Update: {
          referral_code?: string
        }
        Relationships: []
      }
```

Also add `organization_type: string` to the `organizations` Row, Insert, and Update interfaces in the same file.

**Step 3: Type-check**

```bash
cd VEXERA && pnpm type-check
```

Expected: No errors.

**Step 4: Commit**

```bash
git add packages/types/src/index.ts packages/types/src/database.types.ts
git commit -m "feat(types): add OrganizationType, TaxRegime, DphStatus, profile types"
```

---

## Task 3: Tax Calculation Utilities

**Files:**
- Create: `packages/utils/src/tax.ts`
- Modify: `packages/utils/src/index.ts`

**Step 1: Create `packages/utils/src/tax.ts`**

```typescript
// Slovak freelancer tax calculations
// All rates are passed via TaxConfig so they can be updated each fiscal year
// without code changes.

export interface TaxConfig {
  /** Flat expense rate, e.g. 0.60 */
  flatExpenseRate: number
  /** Maximum flat expenses in EUR, e.g. 20000 */
  flatExpenseCap: number
  /** Nezdaniteľná časť základu dane, e.g. 4922.82 */
  nezdanitelnaČiastka: number
  /** Tax rate for income up to incomeThreshold1, e.g. 0.15 */
  standardTaxRate: number
  /** Tax rate for income between threshold1 and threshold2, e.g. 0.19 */
  higherTaxRate: number
  /** Tax rate above incomeThreshold2, e.g. 0.25 */
  topTaxRate: number
  /** Upper bound for standardTaxRate, e.g. 49790 */
  incomeThreshold1: number
  /** Upper bound for higherTaxRate, e.g. 176304 */
  incomeThreshold2: number
  /** Total social insurance rate, e.g. 0.3315 */
  socialRate: number
  /** Total health insurance rate, e.g. 0.14 */
  healthRate: number
  /** Minimum monthly social insurance payment in EUR */
  minSocialMonthly: number
  /** Minimum monthly health insurance payment in EUR */
  minHealthMonthly: number
  /** Social insurance assessment base divisor (usually 12) */
  assessmentMonths: number
}

/** Slovak 2025 tax configuration */
export const SLOVAK_TAX_CONFIG_2025: TaxConfig = {
  flatExpenseRate: 0.60,
  flatExpenseCap: 20000,
  nezdanitelnaČiastka: 4922.82,
  standardTaxRate: 0.15,
  higherTaxRate: 0.19,
  topTaxRate: 0.25,
  incomeThreshold1: 49790,
  incomeThreshold2: 176304,
  socialRate: 0.3315,
  healthRate: 0.14,
  minSocialMonthly: 194.67,
  minHealthMonthly: 97.80,
  assessmentMonths: 12,
}

export interface FreelancerTaxResult {
  /** Expense deduction used */
  expenseDeduction: number
  /** Taxable base after expenses and nezdaniteľná čiastka */
  taxBase: number
  /** Estimated annual income tax */
  estimatedTax: number
  /** Monthly social insurance payment */
  socialMonthly: number
  /** Monthly health insurance payment */
  healthMonthly: number
  /** Predicted monthly social for next year based on this year */
  nextYearSocialMonthly: number
  /** Predicted monthly health for next year based on this year */
  nextYearHealthMonthly: number
}

/**
 * Calculate flat expenses (paušálne výdavky).
 * expenses = min(income * flatExpenseRate, flatExpenseCap)
 */
export function calculateFlatExpenses(income: number, config: TaxConfig): number {
  return Math.min(income * config.flatExpenseRate, config.flatExpenseCap)
}

/**
 * Calculate income tax on a given taxable base.
 * Uses progressive Slovak rates split at thresholds.
 */
function calculateTax(taxBase: number, config: TaxConfig): number {
  if (taxBase <= 0) return 0

  if (taxBase <= config.incomeThreshold1) {
    return round2(taxBase * config.standardTaxRate)
  }

  if (taxBase <= config.incomeThreshold2) {
    const part1 = config.incomeThreshold1 * config.standardTaxRate
    const part2 = (taxBase - config.incomeThreshold1) * config.higherTaxRate
    return round2(part1 + part2)
  }

  const part1 = config.incomeThreshold1 * config.standardTaxRate
  const part2 = (config.incomeThreshold2 - config.incomeThreshold1) * config.higherTaxRate
  const part3 = (taxBase - config.incomeThreshold2) * config.topTaxRate
  return round2(part1 + part2 + part3)
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Full Slovak freelancer tax + insurance calculation.
 *
 * @param income   Annual income (sum of issued invoices)
 * @param expenses Actual recorded expenses (used when tax_regime = 'naklady')
 *                 Pass 0 to use flat-rate calculation
 * @param useFlatExpenses True for 'pausalne_vydavky', false for 'naklady'
 * @param config   Tax configuration for the relevant fiscal year
 */
export function calculateFreelancerTax(
  income: number,
  expenses: number,
  useFlatExpenses: boolean,
  config: TaxConfig,
): FreelancerTaxResult {
  const expenseDeduction = useFlatExpenses
    ? calculateFlatExpenses(income, config)
    : expenses

  const profitBeforeNezdanitelna = Math.max(0, income - expenseDeduction)
  const taxBase = Math.max(0, profitBeforeNezdanitelna - config.nezdanitelnaČiastka)
  const estimatedTax = calculateTax(taxBase, config)

  // Insurance assessment base = half of annual profit / 12
  const annualAssessmentBase = profitBeforeNezdanitelna / 2
  const monthlyAssessmentBase = annualAssessmentBase / config.assessmentMonths

  const socialMonthly = Math.max(
    config.minSocialMonthly,
    round2(monthlyAssessmentBase * config.socialRate)
  )
  const healthMonthly = Math.max(
    config.minHealthMonthly,
    round2(monthlyAssessmentBase * config.healthRate)
  )

  // Next year predictions use this year's assessment base
  const nextYearSocialMonthly = socialMonthly
  const nextYearHealthMonthly = healthMonthly

  return {
    expenseDeduction: round2(expenseDeduction),
    taxBase: round2(taxBase),
    estimatedTax,
    socialMonthly,
    healthMonthly,
    nextYearSocialMonthly,
    nextYearHealthMonthly,
  }
}
```

**Step 2: Export from `packages/utils/src/index.ts`**

Add after the existing exports:

```typescript
export {
  SLOVAK_TAX_CONFIG_2025,
  calculateFlatExpenses,
  calculateFreelancerTax,
  type TaxConfig,
  type FreelancerTaxResult,
} from './tax'
```

**Step 3: Verify calculations manually**

In a scratch file or via Node, verify:
```
income = 30000 EUR, flat expenses:
  flatExpenses = min(30000 * 0.60, 20000) = 18000
  taxBase = max(0, 30000 - 18000 - 4922.82) = 7077.18
  tax = 7077.18 * 0.15 = 1061.58
  monthlyAssessment = (30000 - 18000) / 2 / 12 = 500
  social = max(194.67, 500 * 0.3315) = max(194.67, 165.75) = 194.67
  health = max(97.80, 500 * 0.14) = max(97.80, 70.00) = 97.80
```

**Step 4: Type-check**

```bash
cd VEXERA && pnpm type-check
```

**Step 5: Commit**

```bash
git add packages/utils/src/tax.ts packages/utils/src/index.ts
git commit -m "feat(utils): add Slovak freelancer tax calculation functions"
```

---

## Task 4: Rework Onboarding Wizard — Add Type Selection Step

**Files:**
- Modify: `apps/web/src/components/onboarding/onboarding-wizard.tsx`

The existing wizard has 5 steps (profile, address, team, docs, bank). We're adding a **Step 0: Choose Organization Type** before all existing steps. The type selection creates the org + profile record immediately, then the remaining steps fill in details.

**Step 1: Read the full current file first**

Already done above. Key points:
- Steps are defined in a `STEPS` const array (line 88)
- `OnboardingWizard` starts at `currentStep = 1`
- Step 1 (`Step1Form`) updates the org with name, ICO, DIC, IC DPH
- The wizard uses `activeOrg` from `useOrganization()` — the org must already exist when wizard renders
- `handleFinish()` saves to `localStorage.setItem("onboarding_complete", "true")`

**Architecture decision:** The type-selection step (new Step 0) runs BEFORE the existing steps and sets `organization_type` on the org + creates the profile row. Subsequent steps remain mostly unchanged. For živnostník: skip the "Invite Team" step (Step 3). For accounting_firm: skip team invite too.

**Step 2: Modify `apps/web/src/components/onboarding/onboarding-wizard.tsx`**

Changes needed:
1. Add `OrgTypePicker` component as the new Step 0
2. Update `STEPS` array to include Step 0 (or handle step 0 separately before the progress bar)
3. In `Step1Form`: add tax regime selector (shown only for živnostník) and DPH selector (shown only for firma)
4. Add `orgType` state to `OnboardingWizard`; skip step 3 (Invite Team) if type is `freelancer` or `accounting_firm`
5. After type is selected: call `supabase.from("organizations").update({ organization_type })` and create the profile row

Here is the full replacement. Replace the entire file with:

```tsx
"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import type { Resolver } from "react-hook-form"
import { z } from "zod"
import { toast } from "sonner"
import {
  Building2,
  MapPin,
  FileText,
  Landmark,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Mail,
  Upload,
  ArrowRight,
  Briefcase,
  Store,
  Calculator,
} from "lucide-react"

import { useSupabase } from "@/providers/supabase-provider"
import { useOrganization } from "@/providers/organization-provider"
import { cn } from "@/lib/utils"
import type { OrganizationType, TaxRegime, DphStatus } from "@vexera/types"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

// ─── Type Picker (Step 0) ─────────────────────────────────────────────────────

const TYPE_OPTIONS: {
  type: OrganizationType
  label: string
  description: string
  icon: React.ElementType
  iconBg: string
  iconColor: string
}[] = [
  {
    type: "freelancer",
    label: "Živnostník",
    description: "Samostatne zárobkovo činná osoba. Paušálne výdavky alebo skutočné náklady.",
    icon: Briefcase,
    iconBg: "bg-blue-500/10",
    iconColor: "text-blue-500",
  },
  {
    type: "company",
    label: "Firma",
    description: "Spoločnosť s.r.o. alebo a.s. Platca alebo neplatca DPH.",
    icon: Store,
    iconBg: "bg-violet-500/10",
    iconColor: "text-violet-500",
  },
  {
    type: "accounting_firm",
    label: "Účtovník",
    description: "Účtovná kancelária alebo externý účtovník. Správa viacerých klientov.",
    icon: Calculator,
    iconBg: "bg-emerald-500/10",
    iconColor: "text-emerald-500",
  },
]

function OrgTypePicker({
  onSelect,
}: {
  onSelect: (type: OrganizationType) => Promise<void>
}) {
  const [loading, setLoading] = useState<OrganizationType | null>(null)

  async function handleSelect(type: OrganizationType) {
    setLoading(type)
    await onSelect(type)
    setLoading(null)
  }

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {TYPE_OPTIONS.map((opt) => {
        const Icon = opt.icon
        return (
          <button
            key={opt.type}
            type="button"
            disabled={loading !== null}
            onClick={() => handleSelect(opt.type)}
            className={cn(
              "flex flex-col items-start gap-3 rounded-xl border p-5 text-left transition-all",
              "hover:border-primary hover:shadow-md",
              "focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
              "disabled:opacity-50",
              loading === opt.type && "border-primary shadow-md"
            )}
          >
            <div className={cn("inline-flex rounded-lg p-2.5", opt.iconBg)}>
              <Icon className={cn("h-5 w-5", opt.iconColor)} />
            </div>
            <div>
              <h3 className="font-semibold">{opt.label}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed mt-1">
                {opt.description}
              </p>
            </div>
            {loading === opt.type && (
              <span className="text-xs text-muted-foreground">Nastavujem...</span>
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const step1BaseSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters" }),
  ico: z.string().optional(),
  dic: z.string().optional(),
  ic_dph: z.string().optional(),
  address_country: z.string().optional(),
})

const step1FreelancerSchema = step1BaseSchema.extend({
  tax_regime: z.enum(["pausalne_vydavky", "naklady"]),
})

const step1CompanySchema = step1BaseSchema.extend({
  dph_status: z.enum(["platca", "neplatca"]),
})

const step2Schema = z.object({
  address_street: z.string().optional(),
  address_city: z.string().optional(),
  address_zip: z.string().optional(),
  email: z
    .string()
    .email({ message: "Enter a valid email address" })
    .optional()
    .or(z.literal("")),
  phone: z.string().optional(),
})

type Step1BaseValues = z.infer<typeof step1BaseSchema>
type Step1FreelancerValues = z.infer<typeof step1FreelancerSchema>
type Step1CompanyValues = z.infer<typeof step1CompanySchema>
type Step2Values = z.infer<typeof step2Schema>

// ─── Progress bar ─────────────────────────────────────────────────────────────

function getStepsForType(orgType: OrganizationType | null) {
  const base = [
    { id: 0, label: "Typ profilu", icon: Building2 },
    { id: 1, label: "Profil organizácie", icon: Building2 },
    { id: 2, label: "Kontakt & adresa", icon: MapPin },
    { id: 3, label: "Dokumenty", icon: FileText },
    { id: 4, label: "Banka", icon: Landmark },
  ]
  return base
}

function ProgressBar({
  currentStep,
  orgType,
}: {
  currentStep: number
  orgType: OrganizationType | null
}) {
  const steps = getStepsForType(orgType)
  return (
    <div className="space-y-3 mb-8">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">
          Krok {currentStep + 1} z {steps.length} —{" "}
          <span className="text-foreground font-semibold">
            {steps[currentStep]?.label}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">
          {Math.round((currentStep / steps.length) * 100)}% hotovo
        </p>
      </div>
      <div className="flex gap-1.5">
        {steps.map((step) => (
          <div
            key={step.id}
            className={cn(
              "h-1.5 flex-1 rounded-full transition-colors duration-300",
              currentStep > step.id
                ? "bg-primary"
                : currentStep === step.id
                  ? "bg-primary/60"
                  : "bg-muted"
            )}
          />
        ))}
      </div>
    </div>
  )
}

// ─── Step 1: Organization Profile (type-aware) ─────────────────────────────────

function Step1Form({
  onNext,
  orgName,
  orgType,
}: {
  onNext: () => void
  orgName: string
  orgType: OrganizationType
}) {
  const { supabase } = useSupabase()
  const { activeOrg } = useOrganization()
  const [isLoading, setIsLoading] = useState(false)

  const schema =
    orgType === "freelancer"
      ? step1FreelancerSchema
      : orgType === "company"
        ? step1CompanySchema
        : step1BaseSchema

  const form = useForm<Step1BaseValues>({
    resolver: zodResolver(schema) as unknown as Resolver<Step1BaseValues>,
    defaultValues: {
      name: orgName,
      ico: "",
      dic: "",
      ic_dph: "",
      address_country: "SK",
      ...(orgType === "freelancer" ? { tax_regime: "pausalne_vydavky" } : {}),
      ...(orgType === "company" ? { dph_status: "neplatca" } : {}),
    },
  })

  async function onSubmit(values: Step1BaseValues) {
    if (!activeOrg) return
    setIsLoading(true)
    try {
      // Update org
      const { error: orgError } = await supabase
        .from("organizations")
        .update({
          name: values.name,
          ico: values.ico || undefined,
          dic: (values as Step1FreelancerValues).dic || null,
          ic_dph: (values as Step1CompanyValues).ic_dph || null,
          address_country: values.address_country || "SK",
        })
        .eq("id", activeOrg.id)
      if (orgError) throw orgError

      // Update profile
      if (orgType === "freelancer") {
        const v = values as Step1FreelancerValues
        await supabase.from("freelancer_profiles").upsert({
          organization_id: activeOrg.id,
          tax_regime: v.tax_regime,
        }, { onConflict: "organization_id" })
      } else if (orgType === "company") {
        const v = values as Step1CompanyValues
        await supabase.from("company_profiles").upsert({
          organization_id: activeOrg.id,
          dph_status: v.dph_status,
          ic_dph: v.dph_status === "platca" ? (values as Step1CompanyValues).ic_dph || null : null,
        }, { onConflict: "organization_id" })
      }

      toast.success("Profil organizácie uložený")
      onNext()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chyba pri ukladaní")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>
                {orgType === "freelancer" ? "Obchodné meno *" : "Názov firmy *"}
              </FormLabel>
              <FormControl>
                <Input
                  placeholder={
                    orgType === "freelancer" ? "Ján Novák" : "Acme s.r.o."
                  }
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <FormField
            control={form.control}
            name="ico"
            render={({ field }) => (
              <FormItem>
                <FormLabel>IČO</FormLabel>
                <FormControl>
                  <Input placeholder="12345678" maxLength={8} {...field} />
                </FormControl>
                <FormDescription>8-ciferné IČO</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="dic"
            render={({ field }) => (
              <FormItem>
                <FormLabel>DIČ</FormLabel>
                <FormControl>
                  <Input placeholder="1234567890" maxLength={10} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          {orgType !== "freelancer" && (
            <FormField
              control={form.control}
              name="ic_dph"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>IČ DPH</FormLabel>
                  <FormControl>
                    <Input placeholder="SK1234567890" maxLength={12} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
        </div>

        {/* Tax regime for živnostník */}
        {orgType === "freelancer" && (
          <FormField
            control={form.control as unknown as Parameters<typeof FormField>[0]["control"]}
            name={"tax_regime" as keyof Step1BaseValues}
            render={({ field }) => (
              <FormItem>
                <FormLabel>Daňový režim *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={(field.value as string) ?? "pausalne_vydavky"}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte daňový režim" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="pausalne_vydavky">
                      Paušálne výdavky (60 % príjmov, max 20 000 €)
                    </SelectItem>
                    <SelectItem value="naklady">
                      Skutočné náklady (evidencia výdavkov)
                    </SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>
                  Paušálne výdavky sú jednoduchšie — software vypočíta daň automaticky.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        {/* DPH status for firma */}
        {orgType === "company" && (
          <FormField
            control={form.control as unknown as Parameters<typeof FormField>[0]["control"]}
            name={"dph_status" as keyof Step1BaseValues}
            render={({ field }) => (
              <FormItem>
                <FormLabel>DPH *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={(field.value as string) ?? "neplatca"}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Vyberte DPH status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="neplatca">Neplatca DPH</SelectItem>
                    <SelectItem value="platca">Platca DPH</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="flex justify-end pt-2">
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Ukladám..." : "Pokračovať"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </form>
    </Form>
  )
}

// ─── Step 2: Contact & Address ────────────────────────────────────────────────

function Step2Form({
  onNext,
  onBack,
}: {
  onNext: () => void
  onBack: () => void
}) {
  const { supabase } = useSupabase()
  const { activeOrg } = useOrganization()
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<Step2Values>({
    resolver: zodResolver(step2Schema) as unknown as Resolver<Step2Values>,
    defaultValues: {
      address_street: "",
      address_city: "",
      address_zip: "",
      email: "",
      phone: "",
    },
  })

  async function onSubmit(values: Step2Values) {
    if (!activeOrg) return
    setIsLoading(true)
    try {
      const { error } = await supabase
        .from("organizations")
        .update({
          address_street: values.address_street || null,
          address_city: values.address_city || null,
          address_zip: values.address_zip || null,
          email: values.email || null,
          phone: values.phone || null,
        })
        .eq("id", activeOrg.id)
      if (error) throw error
      toast.success("Kontaktné údaje uložené")
      onNext()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chyba pri ukladaní")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
        <FormField
          control={form.control}
          name="address_street"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Ulica a číslo</FormLabel>
              <FormControl>
                <Input placeholder="Hlavná 1" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="address_city"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Mesto</FormLabel>
                <FormControl>
                  <Input placeholder="Bratislava" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="address_zip"
            render={({ field }) => (
              <FormItem>
                <FormLabel>PSČ</FormLabel>
                <FormControl>
                  <Input placeholder="811 01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Kontaktný email</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="info@firma.sk" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefón</FormLabel>
                <FormControl>
                  <Input placeholder="+421 900 000 000" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <div className="flex justify-between pt-2">
          <Button type="button" variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Späť
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Ukladám..." : "Pokračovať"}
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </form>
    </Form>
  )
}

// ─── Step 3: Documents guidance ───────────────────────────────────────────────

function Step3Guidance({ onNext, onBack }: { onNext: () => void; onBack: () => void }) {
  const router = useRouter()
  const methods = [
    {
      icon: Upload,
      title: "Manuálny upload",
      description: "Nahrajte PDF, JPG alebo PNG priamo z počítača.",
      color: "text-blue-500",
      bg: "bg-blue-500/10",
    },
    {
      icon: Mail,
      title: "Gmail auto-import",
      description: "Prepojte Gmail a faktúry sa importujú automaticky.",
      color: "text-red-500",
      bg: "bg-red-500/10",
    },
    {
      icon: ArrowRight,
      title: "Preposlanie emailom",
      description: "Preposielajte emaily s prílohami na váš Vexera inbox.",
      color: "text-green-500",
      bg: "bg-green-500/10",
    },
  ]

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {methods.map((m) => {
          const Icon = m.icon
          return (
            <div key={m.title} className="rounded-lg border p-4 space-y-2">
              <div className={cn("inline-flex rounded-md p-2", m.bg)}>
                <Icon className={cn("h-5 w-5", m.color)} />
              </div>
              <h3 className="text-sm font-semibold">{m.title}</h3>
              <p className="text-xs text-muted-foreground leading-relaxed">{m.description}</p>
            </div>
          )
        })}
      </div>
      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Späť
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="ghost" onClick={onNext} className="text-muted-foreground">
            Preskočiť
          </Button>
          <Button type="button" onClick={() => router.push("/documents")}>
            <FileText className="h-4 w-4 mr-2" />
            Prejsť na dokumenty
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Step 4: Bank guidance ─────────────────────────────────────────────────────

function Step4Guidance({ onFinish, onBack }: { onFinish: () => void; onBack: () => void }) {
  const router = useRouter()
  return (
    <div className="space-y-6">
      <div className="rounded-lg border p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="rounded-md bg-blue-500/10 p-3 flex-shrink-0">
            <Landmark className="h-6 w-6 text-blue-500" />
          </div>
          <div className="space-y-1">
            <h3 className="font-semibold">Importujte bankový výpis</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Nahrajte bankový výpis vo formáte MT940 alebo CSV. Vexera automaticky
              spáruje transakcie s faktúrami podľa VS a sumy.
            </p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {["MT940", "CSV", "XML", "OFX"].map((fmt) => (
            <div key={fmt} className="rounded-md bg-muted px-3 py-2 text-center">
              <span className="text-sm font-medium">{fmt}</span>
            </div>
          ))}
        </div>
        <Button type="button" variant="outline" className="w-full" onClick={() => router.push("/bank?tab=import")}>
          <Landmark className="h-4 w-4 mr-2" />
          Prejsť na import banky
          <ArrowRight className="h-4 w-4 ml-auto" />
        </Button>
      </div>
      <div className="flex justify-between pt-2">
        <Button type="button" variant="outline" onClick={onBack}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Späť
        </Button>
        <Button type="button" onClick={onFinish}>
          <CheckCircle2 className="h-4 w-4 mr-2" />
          Dokončiť nastavenie
        </Button>
      </div>
    </div>
  )
}

// ─── Completion screen ────────────────────────────────────────────────────────

function CompletionScreen({ onDone }: { onDone: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 space-y-6 text-center">
      <div className="rounded-full bg-green-500/10 p-6">
        <CheckCircle2 className="h-16 w-16 text-green-500" />
      </div>
      <div className="space-y-2">
        <h2 className="text-2xl font-bold">Všetko je pripravené!</h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          Váš profil je nastavený. Začnite spravovať účtovníctvo s Vexerou.
        </p>
      </div>
      <div className="flex flex-col sm:flex-row gap-3">
        <Link href="/invoices/new">
          <Button variant="outline">
            <FileText className="h-4 w-4 mr-2" />
            Vytvoriť prvú faktúru
          </Button>
        </Link>
        <Button onClick={onDone}>
          Na Dashboard
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  )
}

// ─── Main wizard ──────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const router = useRouter()
  const { supabase } = useSupabase()
  const { activeOrg } = useOrganization()
  const [orgType, setOrgType] = useState<OrganizationType | null>(null)
  const [currentStep, setCurrentStep] = useState(0) // 0 = type picker
  const [isComplete, setIsComplete] = useState(false)

  async function handleTypeSelect(type: OrganizationType) {
    if (!activeOrg) return
    try {
      // Set organization_type on the org
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase.from("organizations") as any).update({
        organization_type: type,
      }).eq("id", activeOrg.id)
      if (error) throw error

      // Create accounting_firm_profile if needed (referral code auto-generated by DB)
      if (type === "accounting_firm") {
        await supabase.from("accounting_firm_profiles").upsert(
          { organization_id: activeOrg.id },
          { onConflict: "organization_id" }
        )
      }

      setOrgType(type)
      setCurrentStep(1)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Chyba pri výbere typu")
    }
  }

  function goNext() {
    setCurrentStep((s) => s + 1)
  }

  function goBack() {
    setCurrentStep((s) => Math.max(s - 1, 0))
  }

  function handleFinish() {
    localStorage.setItem("onboarding_complete", "true")
    setIsComplete(true)
  }

  function handleDone() {
    router.push("/")
  }

  const stepTitles: Record<number, { title: string; description: string }> = {
    0: {
      title: "Aký typ profilu máte?",
      description: "Vyberte typ, ktorý najlepšie popisuje vás alebo vašu organizáciu.",
    },
    1: {
      title: "Profil organizácie",
      description: "Doplňte základné informácie — budú sa zobrazovať na faktúrach a dokumentoch.",
    },
    2: {
      title: "Kontakt & adresa",
      description: "Pridajte kontaktné údaje a adresu sídla.",
    },
    3: {
      title: "Nahrajte dokumenty",
      description: "Vyberte, ako chcete importovať faktúry a účtenky.",
    },
    4: {
      title: "Prepojte banku",
      description: "Importujte bankové výpisy pre automatické párovanie transakcií.",
    },
  }

  if (isComplete) {
    return (
      <div className="mx-auto max-w-2xl">
        <Card>
          <CardContent className="pt-6">
            <CompletionScreen onDone={handleDone} />
          </CardContent>
        </Card>
      </div>
    )
  }

  const stepInfo = stepTitles[currentStep]

  return (
    <div className="mx-auto max-w-2xl">
      <ProgressBar currentStep={currentStep} orgType={orgType} />

      <Card>
        <CardHeader>
          <CardTitle className="text-xl">{stepInfo?.title}</CardTitle>
          <CardDescription>{stepInfo?.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {currentStep === 0 && (
            <OrgTypePicker onSelect={handleTypeSelect} />
          )}
          {currentStep === 1 && orgType && (
            <Step1Form onNext={goNext} orgName={activeOrg?.name ?? ""} orgType={orgType} />
          )}
          {currentStep === 2 && (
            <Step2Form onNext={goNext} onBack={goBack} />
          )}
          {currentStep === 3 && (
            <Step3Guidance onNext={goNext} onBack={goBack} />
          )}
          {currentStep === 4 && (
            <Step4Guidance onFinish={handleFinish} onBack={goBack} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 3: Type-check**

```bash
cd VEXERA/apps/web && pnpm type-check
```

Fix any TypeScript errors before proceeding.

**Step 4: Commit**

```bash
git add apps/web/src/components/onboarding/onboarding-wizard.tsx
git commit -m "feat(onboarding): add organization type selection step"
```

---

## Task 5: Update Organization Provider — Include organization_type

**Files:**
- Modify: `apps/web/src/providers/organization-provider.tsx`

**Step 1: Add `organization_type` to the `Organization` type and query**

In `organization-provider.tsx`, change the `Organization` type (line 8-15) to:

```typescript
type Organization = {
  id: string
  name: string
  ico: string
  dic: string | null
  ic_dph: string | null
  subscription_plan: string
  organization_type: string   // NEW
}
```

In the `useQuery` select string (line 62-71), add `organization_type` to the fields:

```typescript
      const { data, error } = await supabase
        .from("organization_members")
        .select(
          `
          organization:organizations (
            id,
            name,
            ico,
            dic,
            ic_dph,
            subscription_plan,
            organization_type
          )
        `
        )
        .eq("user_id", user.id)
```

**Step 2: Type-check**

```bash
cd VEXERA/apps/web && pnpm type-check
```

**Step 3: Commit**

```bash
git add apps/web/src/providers/organization-provider.tsx
git commit -m "feat(provider): expose organization_type from org query"
```

---

## Task 6: Middleware — Onboarding Redirect for New Users

**Files:**
- Modify: `apps/web/src/middleware.ts`
- Read first: `apps/web/src/lib/supabase/middleware.ts` (already done)

**Goal:** Authenticated users without a set organization_type (new users) should be redirected to `/onboarding`. The middleware runs server-side and can check for the `active_organization_id` cookie but not org type (that requires a DB call). Use a lightweight check: if user is authenticated and path is not `/onboarding` and not a public route, and there's no `active_organization_id` cookie, redirect to `/onboarding`.

**Step 1: Modify `apps/web/src/middleware.ts`**

```typescript
import { type NextRequest, NextResponse } from "next/server"
import { updateSession } from "@/lib/supabase/middleware"

const PUBLIC_ROUTES = ["/login", "/register", "/invite", "/api/auth"]
const ONBOARDING_ROUTE = "/onboarding"

export async function middleware(request: NextRequest) {
  const { user, supabaseResponse } = await updateSession(request)

  const pathname = request.nextUrl.pathname

  const isPublicRoute = PUBLIC_ROUTES.some((route) =>
    pathname.startsWith(route)
  )

  // Not authenticated: redirect to login (except public routes)
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Authenticated user on login: redirect to dashboard
  if (user && pathname === "/login") {
    const url = request.nextUrl.clone()
    url.pathname = "/"
    return NextResponse.redirect(url)
  }

  // Authenticated user with no active org cookie: redirect to onboarding
  // Skip if already on onboarding or a public route
  if (
    user &&
    !isPublicRoute &&
    pathname !== ONBOARDING_ROUTE &&
    !pathname.startsWith("/api/") &&
    !request.cookies.get("active_organization_id")?.value
  ) {
    const url = request.nextUrl.clone()
    url.pathname = ONBOARDING_ROUTE
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/webhooks).*)",
  ],
}
```

**Step 2: Type-check**

```bash
cd VEXERA/apps/web && pnpm type-check
```

**Step 3: Manual test**

- Open a private browser window
- Register a new user — verify redirect to `/onboarding`
- Complete onboarding — verify redirect to `/`
- Log out and log back in — verify redirect to `/` (cookie is set)

**Step 4: Commit**

```bash
git add apps/web/src/middleware.ts
git commit -m "feat(middleware): redirect new users to onboarding"
```

---

## Task 7: Dashboard Type Routing

**Files:**
- Modify: `apps/web/src/app/(dashboard)/page.tsx`
- Read first: `apps/web/src/lib/data/org.ts` (need to see if it returns org type)

**Step 1: Read `apps/web/src/lib/data/org.ts`** before modifying to understand `getActiveOrgId()`.

**Step 2: Modify `apps/web/src/app/(dashboard)/page.tsx`**

The current page always shows the generic dashboard. We need to fetch the active org including its type, then:
- `accounting_firm` → render `AccountantDashboardPage` content (or redirect to `/accountant`)
- `freelancer` → show freelancer-specific dashboard (tax meter + insurance)
- `company` → show company dashboard (existing generic dashboard is appropriate for now)

Add type routing after the `orgId` check. The server component can fetch the org type via Supabase server client.

Import and call a new `getActiveOrg()` function (create this in `lib/data/org.ts` if not already there) that returns `{ id, organization_type }`.

For the accounting firm case, redirect to `/accountant`:
```typescript
import { redirect } from "next/navigation"

// after orgId check:
const org = await getActiveOrg()  // returns { id, organization_type, ... }

if (org?.organization_type === "accounting_firm") {
  redirect("/accountant")
}

if (org?.organization_type === "freelancer") {
  return <FreelancerDashboardPage orgId={orgId} />
}

// default: company dashboard (existing content)
```

**Step 3: Create `apps/web/src/components/dashboard/freelancer-dashboard.tsx`** (see Task 8)

**Step 4: Type-check + commit**

```bash
cd VEXERA/apps/web && pnpm type-check
git add apps/web/src/app/(dashboard)/page.tsx apps/web/src/lib/data/org.ts
git commit -m "feat(dashboard): route to type-specific dashboard by org type"
```

---

## Task 8: Freelancer Dashboard — Tax Meter & Insurance Widget

**Files:**
- Create: `apps/web/src/components/dashboard/freelancer-dashboard.tsx`
- Create: `apps/web/src/lib/data/freelancer-tax.ts`

**Step 1: Create `apps/web/src/lib/data/freelancer-tax.ts`**

This server-side data function fetches income YTD and freelancer profile for the org, then runs the tax calculation.

```typescript
import { createClient } from "@/lib/supabase/server"
import { calculateFreelancerTax, SLOVAK_TAX_CONFIG_2025, type FreelancerTaxResult } from "@vexera/utils"

export interface FreelancerTaxData {
  taxResult: FreelancerTaxResult
  incomeYtd: number
  taxRegime: "pausalne_vydavky" | "naklady"
}

export async function getFreelancerTaxData(orgId: string): Promise<FreelancerTaxData> {
  const supabase = await createClient()
  const currentYear = new Date().getFullYear()
  const yearStart = `${currentYear}-01-01`

  // Get total income from paid issued invoices this year
  const { data: invoices } = await supabase
    .from("invoices")
    .select("total")
    .eq("organization_id", orgId)
    .eq("invoice_type", "issued")
    .eq("status", "paid")
    .gte("paid_at", yearStart)

  const incomeYtd = (invoices ?? []).reduce((sum, inv) => sum + (inv.total ?? 0), 0)

  // Get tax regime from freelancer_profiles
  const { data: profile } = await supabase
    .from("freelancer_profiles")
    .select("tax_regime")
    .eq("organization_id", orgId)
    .single()

  const taxRegime = (profile?.tax_regime ?? "pausalne_vydavky") as "pausalne_vydavky" | "naklady"
  const useFlatExpenses = taxRegime === "pausalne_vydavky"

  // For naklady: sum actual expenses from received invoices
  let actualExpenses = 0
  if (!useFlatExpenses) {
    const { data: expenses } = await supabase
      .from("invoices")
      .select("total")
      .eq("organization_id", orgId)
      .eq("invoice_type", "received")
      .gte("created_at", yearStart)
    actualExpenses = (expenses ?? []).reduce((sum, inv) => sum + (inv.total ?? 0), 0)
  }

  const taxResult = calculateFreelancerTax(
    incomeYtd,
    actualExpenses,
    useFlatExpenses,
    SLOVAK_TAX_CONFIG_2025,
  )

  return { taxResult, incomeYtd, taxRegime }
}
```

**Step 2: Create `apps/web/src/components/dashboard/freelancer-dashboard.tsx`**

```tsx
import { Suspense } from "react"
import { TrendingUp, Shield, Calculator, AlertCircle } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { formatEur } from "@vexera/utils"
import { getFreelancerTaxData } from "@/lib/data/freelancer-tax"

async function TaxMeterCard({ orgId }: { orgId: string }) {
  const { taxResult, incomeYtd, taxRegime } = await getFreelancerTaxData(orgId)

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {/* Income YTD */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Príjmy (rok k dnes)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold">{formatEur(incomeYtd)}</p>
          <Badge variant="secondary" className="mt-2 text-xs">
            {taxRegime === "pausalne_vydavky" ? "Paušálne výdavky" : "Skutočné náklady"}
          </Badge>
        </CardContent>
      </Card>

      {/* Estimated tax */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Odhadovaná daň
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-amber-600">{formatEur(taxResult.estimatedTax)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Základ dane: {formatEur(taxResult.taxBase)}
          </p>
        </CardContent>
      </Card>

      {/* Expense deduction */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
            Výdavkový odpočet
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-bold text-emerald-600">{formatEur(taxResult.expenseDeduction)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {taxRegime === "pausalne_vydavky" ? "60 % príjmov (max 20 000 €)" : "Skutočné výdavky"}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

async function InsuranceCard({ orgId }: { orgId: string }) {
  const { taxResult } = await getFreelancerTaxData(orgId)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Odvody
        </CardTitle>
        <CardDescription>Mesačné platby poistného</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Sociálna poisťovňa (teraz)</p>
            <p className="text-xl font-bold">{formatEur(taxResult.socialMonthly)}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Zdravotná poisťovňa (teraz)</p>
            <p className="text-xl font-bold">{formatEur(taxResult.healthMonthly)}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Sociálna (budúci rok)
            </p>
            <p className="text-xl font-bold text-amber-600">{formatEur(taxResult.nextYearSocialMonthly)}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertCircle className="h-3 w-3" /> Zdravotná (budúci rok)
            </p>
            <p className="text-xl font-bold text-amber-600">{formatEur(taxResult.nextYearHealthMonthly)}<span className="text-sm font-normal text-muted-foreground">/mes</span></p>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Predikcia budúcoročných odvodov vychádza z aktuálnych príjmov. Aktualizuje sa s každou novou faktúrou.
        </p>
      </CardContent>
    </Card>
  )
}

export async function FreelancerDashboard({ orgId }: { orgId: string }) {
  return (
    <div className="space-y-8 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Prehľad</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Vaše dane a odvody na rok {new Date().getFullYear()}.</p>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-2">
          <Calculator className="h-4 w-4" />
          Daňový prehľad
        </h2>
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <TaxMeterCard orgId={orgId} />
        </Suspense>
      </section>

      <section>
        <Suspense fallback={<Skeleton className="h-40 w-full rounded-xl" />}>
          <InsuranceCard orgId={orgId} />
        </Suspense>
      </section>
    </div>
  )
}
```

**Step 3: Type-check**

```bash
cd VEXERA/apps/web && pnpm type-check
```

**Step 4: Commit**

```bash
git add apps/web/src/components/dashboard/freelancer-dashboard.tsx \
        apps/web/src/lib/data/freelancer-tax.ts
git commit -m "feat(dashboard): add freelancer tax meter and insurance widgets"
```

---

## Task 9: Accountant Dashboard — Referral Link Section

**Files:**
- Modify: `apps/web/src/components/dashboard/accountant-dashboard.tsx`

**Step 1: Add a referral link section to the existing `AccountantDashboard` component**

The referral link is based on the accountant's org's `accounting_firm_profiles.referral_code`. The data needs to be passed in. First check how `getAccountantDashboard()` is structured and add `referral_code` to the returned data.

Read `apps/web/src/lib/data/accountant-dashboard.ts` before modifying (it's the data function).

Then add `referral_code: string | null` to `AccountantDashboardData` type in `packages/types/src/index.ts` and populate it in the data function by querying `accounting_firm_profiles` for the org.

In the component, add a referral link card at the bottom:

```tsx
{data.referral_code && (
  <Card>
    <CardHeader>
      <CardTitle className="text-base">Referálny odkaz</CardTitle>
      <CardDescription className="text-xs">
        Pošlite tento odkaz klientom — po registrácii budú automaticky prepojení s vašou kanceláriou.
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div className="flex gap-2">
        <code className="flex-1 rounded-md bg-muted px-3 py-2 text-sm font-mono truncate">
          {`${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.vexera.sk"}/register?ref=${data.referral_code}`}
        </code>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            navigator.clipboard.writeText(
              `${process.env.NEXT_PUBLIC_APP_URL ?? "https://app.vexera.sk"}/register?ref=${data.referral_code}`
            )
            toast.success("Odkaz skopírovaný!")
          }}
        >
          Kopírovať
        </Button>
      </div>
    </CardContent>
  </Card>
)}
```

**Step 2: Type-check**

```bash
cd VEXERA/apps/web && pnpm type-check
```

**Step 3: Commit**

```bash
git add apps/web/src/components/dashboard/accountant-dashboard.tsx \
        apps/web/src/lib/data/accountant-dashboard.ts \
        packages/types/src/index.ts
git commit -m "feat(accountant): add referral link to accountant dashboard"
```

---

## Verification Checklist

Run through these after all tasks complete:

```bash
# 1. Full type-check
cd VEXERA && pnpm type-check

# 2. Lint
cd VEXERA && pnpm lint

# 3. Dev server
cd VEXERA/apps/web && pnpm dev
```

**Manual browser tests:**

| Scenario | Expected |
|---|---|
| New user registers | Redirected to `/onboarding` (no org cookie) |
| Step 0: click Živnostník | `organization_type = 'freelancer'` set on org, `freelancer_profiles` row created |
| Step 1 as Živnostník | Shows tax regime selector (Paušálne / Skutočné), no DPH field |
| Step 1 as Firma | Shows DPH selector (Platca / Neplatca) |
| Step 0: click Účtovník | `organization_type = 'accounting_firm'`, `accounting_firm_profiles` row with referral_code created |
| Dashboard as Živnostník | Shows tax meter + insurance cards |
| Dashboard as Účtovník | Redirects to `/accountant` |
| Accountant dashboard | Shows referral link |
| RLS: query freelancer_profiles as different org user | Returns 0 rows |

---

## File Change Summary

| File | Action |
|---|---|
| `supabase/migrations/20240101000028_organization_types.sql` | Create |
| `packages/types/src/index.ts` | Add OrganizationType, TaxRegime, DphStatus, profile interfaces |
| `packages/types/src/database.types.ts` | Add freelancer_profiles, company_profiles, accounting_firm_profiles tables |
| `packages/utils/src/tax.ts` | Create |
| `packages/utils/src/index.ts` | Export tax functions |
| `apps/web/src/components/onboarding/onboarding-wizard.tsx` | Full rewrite with type-selection step |
| `apps/web/src/providers/organization-provider.tsx` | Add organization_type to type + query |
| `apps/web/src/middleware.ts` | Add onboarding redirect |
| `apps/web/src/app/(dashboard)/page.tsx` | Add org-type routing |
| `apps/web/src/lib/data/freelancer-tax.ts` | Create |
| `apps/web/src/components/dashboard/freelancer-dashboard.tsx` | Create |
| `apps/web/src/lib/data/accountant-dashboard.ts` | Add referral_code to returned data |
| `apps/web/src/components/dashboard/accountant-dashboard.tsx` | Add referral link card |
| `packages/types/src/index.ts` | Add referral_code to AccountantDashboardData |
