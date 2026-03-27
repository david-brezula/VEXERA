# Slovak Accounting Engine — Correct Calculations & Setup Flow

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix all Slovak tax, insurance, and VAT calculations to match 2026 law, and extend the živnostník setup flow to capture required data.

**Architecture:** Replace the flat `TaxConfig` with a structured `SlovakTaxLegislation` that models actual Slovak law (progressive brackets as arrays, nezdaniteľná časť with reduction formula, insurance with osobitný základ). Extend `freelancer_profiles` table with new columns. Update onboarding wizard with additional steps.

**Tech Stack:** TypeScript, Vitest, Supabase (PostgreSQL), Next.js, React Hook Form, Zod

---

## Task 1: New Tax Types & Interfaces

**Files:**
- Modify: `packages/types/src/index.ts`
- Modify: `packages/utils/src/index.ts`

**Step 1: Add new types to `packages/types/src/index.ts`**

Add after line 94 (after `VatRate` type):

```typescript
// --- Slovak Tax Legislation Types ---

export interface TaxBracket {
  /** Upper bound of this bracket (null = unlimited / top bracket) */
  upTo: number | null
  /** Tax rate as decimal (e.g. 0.19 = 19%) */
  rate: number
}

export interface InsuranceConfig {
  socialRate: number
  healthRate: number
  healthRateDisabled: number
  minVymeriavaciZaklad: number
  maxVymeriavaciZaklad: number
  osobitnyVymeriavaciZaklad: number
  osobitnyIncomeThreshold: number
}

export interface NezdanitelnaConfig {
  plnaCiastka: number
  limitZakladDane: number
  maxOdpocet: number
}

export interface SlovakTaxLegislation {
  year: number
  flatExpenseRate: number
  flatExpenseCap: number
  smallBusinessIncomeLimit: number
  smallBusinessTaxRate: number
  progressiveBrackets: TaxBracket[]
  nezdanitelna: NezdanitelnaConfig
  insurance: InsuranceConfig
  assessmentMonths: number
}

export interface FreelancerTaxProfile {
  taxRegime: TaxRegime
  isVatPayer: boolean
  isFirstYear: boolean
  foundingDate?: string
  hasSocialInsurance: boolean
  paidSocialMonthly?: number
  paidHealthMonthly?: number
  isDisabled?: boolean
}

export interface FreelancerTaxResult {
  expenseDeduction: number
  insuranceDeduction: number
  nezdanitelnaCiastka: number
  taxBase: number
  estimatedTax: number
  socialMonthly: number
  healthMonthly: number
  nextYearSocialMonthly: number
  nextYearHealthMonthly: number
}
```

**Step 2: Export new types from `packages/utils/src/index.ts`**

Update the tax exports to include the new config and function names (will be added in Task 2).

**Step 3: Commit**

```bash
git add packages/types/src/index.ts packages/utils/src/index.ts
git commit -m "feat: add SlovakTaxLegislation types and FreelancerTaxProfile interface"
```

---

## Task 2: Rewrite Tax Engine (`packages/utils/src/tax.ts`)

**Files:**
- Modify: `packages/utils/src/tax.ts`

**Step 1: Write new `tax.ts` with correct 2026 values**

Replace the full file content with:

```typescript
// Slovak freelancer tax calculations — 2026 legislation
// Sources:
//   https://www.podnikajte.sk/dan-z-prijmov/nezdanitelne-casti-zakladu-dane-2026
//   https://www.podnikajte.sk/socialne-a-zdravotne-odvody/minimalne-odvody-szco-od-1-1-2026
//   https://www.podnikajte.sk/dan-z-prijmov/progresivne-zdanenie-prijmov-fyzickych-osob-od-2026

import type {
  SlovakTaxLegislation,
  FreelancerTaxProfile,
  FreelancerTaxResult,
  TaxBracket,
  NezdanitelnaConfig,
  InsuranceConfig,
} from '@vexera/types'

// --- Legacy types (deprecated, kept for backward compatibility) ---

export interface TaxConfig {
  flatExpenseRate: number
  flatExpenseCap: number
  nezdanitelnaČiastka: number
  standardTaxRate: number
  higherTaxRate: number
  topTaxRate: number
  incomeThreshold1: number
  incomeThreshold2: number
  socialRate: number
  healthRate: number
  minSocialMonthly: number
  minHealthMonthly: number
  assessmentMonths: number
}

/** @deprecated Use SLOVAK_TAX_LEGISLATION_2026 */
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

/** @deprecated Use SLOVAK_TAX_LEGISLATION_2026 */
export const SLOVAK_TAX_CONFIG_2026: TaxConfig = {
  flatExpenseRate: 0.60,
  flatExpenseCap: 20000,
  nezdanitelnaČiastka: 5966.73,
  standardTaxRate: 0.15,
  higherTaxRate: 0.19,
  topTaxRate: 0.25,
  incomeThreshold1: 100000,
  incomeThreshold2: 176304,
  socialRate: 0.3315,
  healthRate: 0.16,
  minSocialMonthly: 303.11,
  minHealthMonthly: 121.92,
  assessmentMonths: 12,
}

// --- New structured legislation configs ---

export const SLOVAK_TAX_LEGISLATION_2026: SlovakTaxLegislation = {
  year: 2026,
  flatExpenseRate: 0.60,
  flatExpenseCap: 20000,
  smallBusinessIncomeLimit: 100000,
  smallBusinessTaxRate: 0.15,
  progressiveBrackets: [
    { upTo: 43983.32, rate: 0.19 },
    { upTo: 60349.21, rate: 0.25 },
    { upTo: 75010.32, rate: 0.30 },
    { upTo: null, rate: 0.35 },
  ],
  nezdanitelna: {
    plnaCiastka: 5966.73,
    limitZakladDane: 26367.26,
    maxOdpocet: 12558.55,
  },
  insurance: {
    socialRate: 0.3315,
    healthRate: 0.16,
    healthRateDisabled: 0.08,
    minVymeriavaciZaklad: 914.40,
    maxVymeriavaciZaklad: 16764,
    osobitnyVymeriavaciZaklad: 396.24,
    osobitnyIncomeThreshold: 9144,
  },
  assessmentMonths: 12,
}

const legislationByYear: Record<number, SlovakTaxLegislation> = {
  2026: SLOVAK_TAX_LEGISLATION_2026,
}

export function getLegislation(year: number): SlovakTaxLegislation {
  return legislationByYear[year] ?? SLOVAK_TAX_LEGISLATION_2026
}

// --- Utility ---

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

// --- Calculation functions ---

export function calculateFlatExpenses(income: number, rateOrLegislation: number | SlovakTaxLegislation, cap?: number): number {
  if (typeof rateOrLegislation === 'number') {
    // Legacy overload: calculateFlatExpenses(income, rate, cap)
    return Math.min(income * rateOrLegislation, cap ?? 20000)
  }
  const leg = rateOrLegislation
  return Math.min(income * leg.flatExpenseRate, leg.flatExpenseCap)
}

export function calculateNezdanitelnaCiastka(
  zakladDaneBeforeNezdanitelna: number,
  config: NezdanitelnaConfig,
): number {
  if (zakladDaneBeforeNezdanitelna <= 0) return config.plnaCiastka
  if (zakladDaneBeforeNezdanitelna <= config.limitZakladDane) {
    return config.plnaCiastka
  }
  return Math.max(0, round2(config.maxOdpocet - zakladDaneBeforeNezdanitelna / 4))
}

export function calculateProgressiveTax(
  taxBase: number,
  brackets: TaxBracket[],
): number {
  if (taxBase <= 0) return 0
  let remaining = taxBase
  let tax = 0
  let prevUpTo = 0
  for (const bracket of brackets) {
    const bracketSize = bracket.upTo !== null ? bracket.upTo - prevUpTo : Infinity
    const taxable = Math.min(remaining, bracketSize)
    tax += taxable * bracket.rate
    remaining -= taxable
    prevUpTo = bracket.upTo ?? 0
    if (remaining <= 0) break
  }
  return round2(tax)
}

export function calculateTaxAmount(
  taxBase: number,
  grossIncome: number,
  legislation: SlovakTaxLegislation,
): number {
  if (taxBase <= 0) return 0
  if (grossIncome <= legislation.smallBusinessIncomeLimit) {
    return round2(taxBase * legislation.smallBusinessTaxRate)
  }
  return calculateProgressiveTax(taxBase, legislation.progressiveBrackets)
}

export function calculateInsurance(
  income: number,
  expenses: number,
  profile: FreelancerTaxProfile,
  legislation: SlovakTaxLegislation,
): { socialMonthly: number; healthMonthly: number } {
  const ins = legislation.insurance
  const healthRate = profile.isDisabled ? ins.healthRateDisabled : ins.healthRate

  // If user provided their actual monthly amounts, use those
  if (profile.paidSocialMonthly !== undefined && profile.paidHealthMonthly !== undefined) {
    return {
      socialMonthly: profile.paidSocialMonthly,
      healthMonthly: profile.paidHealthMonthly,
    }
  }

  // First-year SZČO: no social insurance obligation (health is always mandatory)
  if (profile.isFirstYear && !profile.hasSocialInsurance) {
    const healthMonthly = Math.max(
      round2(ins.minVymeriavaciZaklad * healthRate),
      round2(ins.minVymeriavaciZaklad * healthRate),
    )
    return {
      socialMonthly: 0,
      healthMonthly,
    }
  }

  // Calculate vymeriavací základ from profit
  const expenseDeduction = profile.taxRegime === 'pausalne_vydavky'
    ? Math.min(income * legislation.flatExpenseRate, legislation.flatExpenseCap)
    : expenses
  const profit = Math.max(0, income - expenseDeduction)
  const annualAssessmentBase = profit / 1.486
  const monthlyBase = annualAssessmentBase / legislation.assessmentMonths

  // Low-income or new SZČO → osobitný vymeriavací základ
  if (income <= ins.osobitnyIncomeThreshold) {
    return {
      socialMonthly: round2(ins.osobitnyVymeriavaciZaklad * ins.socialRate),
      healthMonthly: Math.max(
        round2(ins.minVymeriavaciZaklad * healthRate),
        round2(ins.osobitnyVymeriavaciZaklad * healthRate),
      ),
    }
  }

  // Clamp to min/max vymeriavací základ
  const clampedBase = Math.min(
    Math.max(monthlyBase, ins.minVymeriavaciZaklad),
    ins.maxVymeriavaciZaklad,
  )

  return {
    socialMonthly: round2(clampedBase * ins.socialRate),
    healthMonthly: round2(clampedBase * healthRate),
  }
}

export function calculateFreelancerTaxV2(
  income: number,
  expenses: number,
  profile: FreelancerTaxProfile,
  legislation: SlovakTaxLegislation,
): FreelancerTaxResult {
  // 1. Determine expense deduction
  const expenseDeduction = profile.taxRegime === 'pausalne_vydavky'
    ? calculateFlatExpenses(income, legislation)
    : expenses

  const profitBeforeDeductions = Math.max(0, income - expenseDeduction)

  // 2. Calculate insurance
  const { socialMonthly, healthMonthly } = calculateInsurance(
    income, expenses, profile, legislation,
  )

  // 3. Determine insurance deduction from tax base
  let insuranceDeduction: number
  if (profile.paidSocialMonthly !== undefined || profile.paidHealthMonthly !== undefined) {
    insuranceDeduction = round2(
      ((profile.paidSocialMonthly ?? 0) + (profile.paidHealthMonthly ?? 0)) * legislation.assessmentMonths,
    )
  } else if (profile.taxRegime === 'pausalne_vydavky') {
    insuranceDeduction = round2((socialMonthly + healthMonthly) * legislation.assessmentMonths)
  } else {
    // skutočné náklady: insurance already included in expenses
    insuranceDeduction = 0
  }

  // 4. Calculate nezdaniteľná časť (with reduction for high earners)
  const baseBeforeNezdanitelna = Math.max(0, profitBeforeDeductions - insuranceDeduction)
  const nezdanitelnaCiastka = calculateNezdanitelnaCiastka(
    baseBeforeNezdanitelna,
    legislation.nezdanitelna,
  )

  // 5. Calculate tax base and tax
  const taxBase = Math.max(0, round2(baseBeforeNezdanitelna - nezdanitelnaCiastka))
  const estimatedTax = calculateTaxAmount(taxBase, income, legislation)

  // 6. Project next-year insurance (same as current estimate)
  return {
    expenseDeduction: round2(expenseDeduction),
    insuranceDeduction: round2(insuranceDeduction),
    nezdanitelnaCiastka: round2(nezdanitelnaCiastka),
    taxBase,
    estimatedTax,
    socialMonthly,
    healthMonthly,
    nextYearSocialMonthly: socialMonthly,
    nextYearHealthMonthly: healthMonthly,
  }
}

// --- Legacy function (kept for backward compatibility) ---

/** @deprecated Use calculateFreelancerTaxV2 with SlovakTaxLegislation */
export function calculateFreelancerTax(
  income: number,
  expenses: number,
  useFlatExpenses: boolean,
  config: TaxConfig,
  paidInsurance?: { social: number; health: number },
): Omit<FreelancerTaxResult, 'nezdanitelnaCiastka'> {
  const expenseDeduction = useFlatExpenses
    ? Math.min(income * config.flatExpenseRate, config.flatExpenseCap)
    : expenses

  const profitBeforeNezdanitelna = Math.max(0, income - expenseDeduction)
  const annualAssessmentBase = profitBeforeNezdanitelna / 2
  const monthlyAssessmentBase = annualAssessmentBase / config.assessmentMonths

  const socialMonthly = Math.max(
    config.minSocialMonthly,
    round2(monthlyAssessmentBase * config.socialRate),
  )
  const healthMonthly = Math.max(
    config.minHealthMonthly,
    round2(monthlyAssessmentBase * config.healthRate),
  )

  let insuranceDeduction: number
  if (paidInsurance) {
    insuranceDeduction = paidInsurance.social + paidInsurance.health
  } else if (useFlatExpenses) {
    insuranceDeduction = round2((socialMonthly + healthMonthly) * config.assessmentMonths)
  } else {
    insuranceDeduction = 0
  }

  const taxBase = Math.max(0, profitBeforeNezdanitelna - insuranceDeduction - config.nezdanitelnaČiastka)

  // Legacy: simple bracket logic
  let estimatedTax: number
  if (taxBase <= 0) {
    estimatedTax = 0
  } else if (income <= config.incomeThreshold1) {
    estimatedTax = round2(taxBase * config.standardTaxRate)
  } else if (taxBase <= config.incomeThreshold2) {
    estimatedTax = round2(taxBase * config.higherTaxRate)
  } else {
    const part1 = config.incomeThreshold2 * config.higherTaxRate
    const part2 = (taxBase - config.incomeThreshold2) * config.topTaxRate
    estimatedTax = round2(part1 + part2)
  }

  return {
    expenseDeduction: round2(expenseDeduction),
    insuranceDeduction: round2(insuranceDeduction),
    taxBase: round2(taxBase),
    estimatedTax,
    socialMonthly,
    healthMonthly,
    nextYearSocialMonthly: socialMonthly,
    nextYearHealthMonthly: healthMonthly,
  }
}
```

**Step 2: Update exports in `packages/utils/src/index.ts`**

Add to the tax section exports:
```typescript
export {
  // Legacy (deprecated)
  SLOVAK_TAX_CONFIG_2025,
  SLOVAK_TAX_CONFIG_2026,
  calculateFlatExpenses,
  calculateFreelancerTax,
  // New 2026 engine
  SLOVAK_TAX_LEGISLATION_2026,
  getLegislation,
  calculateNezdanitelnaCiastka,
  calculateProgressiveTax,
  calculateTaxAmount,
  calculateInsurance,
  calculateFreelancerTaxV2,
} from './tax'
export type { TaxConfig } from './tax'
```

**Step 3: Run type check**

```bash
cd packages/utils && pnpm run type-check
```
Expected: No errors

**Step 4: Commit**

```bash
git add packages/utils/src/tax.ts packages/utils/src/index.ts
git commit -m "feat: rewrite tax engine with correct 2026 Slovak legislation values

- Add SlovakTaxLegislation structured config with 4 progressive brackets
- Fix nezdaniteľná časť: 5966.73 with reduction formula
- Fix health insurance rate: 16% (was 14%)
- Fix minimums: social 303.11, health 121.92
- Add osobitný vymeriavací základ for low-income/new SZČO
- Add max vymeriavací základ cap (16764/month)
- Keep legacy calculateFreelancerTax for backward compatibility"
```

---

## Task 3: Write Tests for New Tax Engine

**Files:**
- Modify: `packages/utils/src/tax.test.ts`

**Step 1: Add new test suites after existing tests**

Append to `tax.test.ts`:

```typescript
import {
  SLOVAK_TAX_LEGISLATION_2026,
  calculateNezdanitelnaCiastka,
  calculateProgressiveTax,
  calculateTaxAmount,
  calculateInsurance,
  calculateFreelancerTaxV2,
  getLegislation,
} from "./tax"
import type { FreelancerTaxProfile } from "@vexera/types"

const leg = SLOVAK_TAX_LEGISLATION_2026

// Helper to create a default profile
function makeProfile(overrides: Partial<FreelancerTaxProfile> = {}): FreelancerTaxProfile {
  return {
    taxRegime: 'pausalne_vydavky',
    isVatPayer: false,
    isFirstYear: false,
    hasSocialInsurance: true,
    ...overrides,
  }
}

describe("getLegislation", () => {
  it("returns 2026 config for year 2026", () => {
    expect(getLegislation(2026)).toBe(SLOVAK_TAX_LEGISLATION_2026)
  })

  it("falls back to 2026 for unknown year", () => {
    expect(getLegislation(2099)).toBe(SLOVAK_TAX_LEGISLATION_2026)
  })
})

describe("SLOVAK_TAX_LEGISLATION_2026 values", () => {
  it("has correct nezdaniteľná časť", () => {
    expect(leg.nezdanitelna.plnaCiastka).toBe(5966.73)
  })

  it("has correct health rate (16%)", () => {
    expect(leg.insurance.healthRate).toBe(0.16)
  })

  it("has correct min social monthly (303.11)", () => {
    const minSocial = Math.round(leg.insurance.minVymeriavaciZaklad * leg.insurance.socialRate * 100) / 100
    expect(minSocial).toBe(303.11)
  })

  it("has correct min health monthly (121.92)", () => {
    const minHealth = Math.round(leg.insurance.minVymeriavaciZaklad * leg.insurance.healthRate * 100) / 100
    expect(minHealth).toBe(121.92)
  })

  it("has 4 progressive brackets", () => {
    expect(leg.progressiveBrackets).toHaveLength(4)
    expect(leg.progressiveBrackets[0].rate).toBe(0.19)
    expect(leg.progressiveBrackets[1].rate).toBe(0.25)
    expect(leg.progressiveBrackets[2].rate).toBe(0.30)
    expect(leg.progressiveBrackets[3].rate).toBe(0.35)
    expect(leg.progressiveBrackets[3].upTo).toBeNull()
  })

  it("has correct osobitný vymeriavací základ", () => {
    expect(leg.insurance.osobitnyVymeriavaciZaklad).toBe(396.24)
    const osobitnyOdvod = Math.round(396.24 * 0.3315 * 100) / 100
    expect(osobitnyOdvod).toBe(131.34)
  })
})

describe("calculateNezdanitelnaCiastka", () => {
  const nc = leg.nezdanitelna

  it("returns full amount when základ dane is low", () => {
    expect(calculateNezdanitelnaCiastka(15000, nc)).toBe(5966.73)
  })

  it("returns full amount at the limit boundary", () => {
    expect(calculateNezdanitelnaCiastka(26367.26, nc)).toBe(5966.73)
  })

  it("reduces for základ dane above limit", () => {
    // formula: max(0, 12558.55 - 30000/4) = max(0, 12558.55 - 7500) = 5058.55
    expect(calculateNezdanitelnaCiastka(30000, nc)).toBe(5058.55)
  })

  it("returns 0 for very high základ dane", () => {
    // 12558.55 - 60000/4 = 12558.55 - 15000 = -2441.45 → 0
    expect(calculateNezdanitelnaCiastka(60000, nc)).toBe(0)
  })

  it("returns full amount for zero income", () => {
    expect(calculateNezdanitelnaCiastka(0, nc)).toBe(5966.73)
  })
})

describe("calculateProgressiveTax", () => {
  const brackets = leg.progressiveBrackets

  it("applies 19% for low taxBase", () => {
    expect(calculateProgressiveTax(20000, brackets)).toBe(
      Math.round(20000 * 0.19 * 100) / 100,
    )
  })

  it("applies two brackets correctly", () => {
    const taxBase = 50000
    const part1 = 43983.32 * 0.19
    const part2 = (50000 - 43983.32) * 0.25
    expect(calculateProgressiveTax(taxBase, brackets)).toBe(
      Math.round((part1 + part2) * 100) / 100,
    )
  })

  it("applies all four brackets for very high income", () => {
    const taxBase = 100000
    const part1 = 43983.32 * 0.19
    const part2 = (60349.21 - 43983.32) * 0.25
    const part3 = (75010.32 - 60349.21) * 0.30
    const part4 = (100000 - 75010.32) * 0.35
    expect(calculateProgressiveTax(taxBase, brackets)).toBe(
      Math.round((part1 + part2 + part3 + part4) * 100) / 100,
    )
  })

  it("returns 0 for zero taxBase", () => {
    expect(calculateProgressiveTax(0, brackets)).toBe(0)
  })
})

describe("calculateTaxAmount", () => {
  it("applies 15% flat rate for income <= 100k", () => {
    expect(calculateTaxAmount(20000, 80000, leg)).toBe(
      Math.round(20000 * 0.15 * 100) / 100,
    )
  })

  it("applies progressive brackets for income > 100k", () => {
    const taxBase = 50000
    expect(calculateTaxAmount(taxBase, 120000, leg)).toBe(
      calculateProgressiveTax(taxBase, leg.progressiveBrackets),
    )
  })
})

describe("calculateInsurance", () => {
  it("returns 0 social for first-year SZČO without obligation", () => {
    const profile = makeProfile({ isFirstYear: true, hasSocialInsurance: false })
    const result = calculateInsurance(20000, 0, profile, leg)
    expect(result.socialMonthly).toBe(0)
    expect(result.healthMonthly).toBeGreaterThan(0)
  })

  it("uses osobitný základ for low-income SZČO", () => {
    const profile = makeProfile()
    const result = calculateInsurance(8000, 0, profile, leg)
    expect(result.socialMonthly).toBe(
      Math.round(396.24 * 0.3315 * 100) / 100,
    ) // 131.34
  })

  it("uses user-provided amounts when available", () => {
    const profile = makeProfile({ paidSocialMonthly: 350, paidHealthMonthly: 150 })
    const result = calculateInsurance(50000, 0, profile, leg)
    expect(result.socialMonthly).toBe(350)
    expect(result.healthMonthly).toBe(150)
  })

  it("uses reduced health rate for disabled persons", () => {
    const profile = makeProfile({ isDisabled: true })
    const result = calculateInsurance(8000, 0, profile, leg)
    // 8% instead of 16%
    expect(result.healthMonthly).toBeLessThan(
      Math.round(leg.insurance.minVymeriavaciZaklad * 0.16 * 100) / 100,
    )
  })

  it("caps at max vymeriavací základ", () => {
    const profile = makeProfile()
    const result = calculateInsurance(500000, 0, profile, leg)
    const maxSocial = Math.round(16764 * 0.3315 * 100) / 100
    expect(result.socialMonthly).toBeLessThanOrEqual(maxSocial)
  })
})

describe("calculateFreelancerTaxV2", () => {
  it("30k income, paušálne, non-DPH → correct 2026 values", () => {
    const profile = makeProfile()
    const result = calculateFreelancerTaxV2(30000, 0, profile, leg)

    expect(result.expenseDeduction).toBe(18000) // 60% of 30k
    expect(result.nezdanitelnaCiastka).toBe(5966.73) // full, base is low
    expect(result.taxBase).toBeGreaterThanOrEqual(0)
    expect(result.estimatedTax).toBeGreaterThanOrEqual(0)
    // 15% rate since income <= 100k
    if (result.taxBase > 0) {
      expect(result.estimatedTax).toBe(
        Math.round(result.taxBase * 0.15 * 100) / 100,
      )
    }
  })

  it("120k income → progressive brackets, not 15%", () => {
    const profile = makeProfile({ paidSocialMonthly: 0, paidHealthMonthly: 0 })
    const result = calculateFreelancerTaxV2(120000, 0, profile, leg)

    // income > 100k → progressive
    expect(result.estimatedTax).toBe(
      calculateProgressiveTax(result.taxBase, leg.progressiveBrackets),
    )
  })

  it("skutočné náklady: insurance not double-deducted", () => {
    const profile = makeProfile({ taxRegime: 'naklady' })
    const result = calculateFreelancerTaxV2(50000, 20000, profile, leg)

    expect(result.expenseDeduction).toBe(20000)
    expect(result.insuranceDeduction).toBe(0)
  })

  it("first-year SZČO has 0 social insurance", () => {
    const profile = makeProfile({
      isFirstYear: true,
      hasSocialInsurance: false,
      foundingDate: '2026-01-15',
    })
    const result = calculateFreelancerTaxV2(30000, 0, profile, leg)

    expect(result.socialMonthly).toBe(0)
    expect(result.healthMonthly).toBeGreaterThan(0)
  })

  it("high earner gets reduced nezdaniteľná časť", () => {
    const profile = makeProfile({ paidSocialMonthly: 0, paidHealthMonthly: 0 })
    const result = calculateFreelancerTaxV2(80000, 0, profile, leg)

    // profit = 60000 (80k - 20k flat cap), insurance = 0
    // nezdanitelna = max(0, 12558.55 - 60000/4) = max(0, -1441.45) = 0
    expect(result.nezdanitelnaCiastka).toBe(0)
  })

  it("handles zero income", () => {
    const profile = makeProfile()
    const result = calculateFreelancerTaxV2(0, 0, profile, leg)

    expect(result.expenseDeduction).toBe(0)
    expect(result.taxBase).toBe(0)
    expect(result.estimatedTax).toBe(0)
    expect(result.nezdanitelnaCiastka).toBe(5966.73)
  })
})
```

**Step 2: Run tests**

```bash
cd packages/utils && pnpm run test
```

Expected: All new tests pass. Legacy tests still pass (they use `SLOVAK_TAX_CONFIG_2025` which is unchanged).

**Step 3: Fix any failing tests and re-run**

**Step 4: Commit**

```bash
git add packages/utils/src/tax.test.ts
git commit -m "test: add comprehensive tests for 2026 Slovak tax engine

- Test correct config values (nezdaniteľná, rates, minimums)
- Test nezdaniteľná časť reduction formula
- Test 4-bracket progressive tax
- Test 15% vs progressive threshold at 100k
- Test first-year SZČO insurance exemption
- Test osobitný vymeriavací základ for low-income
- Test disabled person health rate
- Test max vymeriavací základ cap"
```

---

## Task 4: Database Migration — Extend freelancer_profiles

**Files:**
- Create: `supabase/migrations/20240101000055_freelancer_profile_insurance_fields.sql`

**Step 1: Write the migration**

```sql
-- Add insurance and first-year fields to freelancer_profiles
-- Required for accurate Slovak tax calculations (2026 law)

ALTER TABLE freelancer_profiles
  ADD COLUMN is_first_year BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN founding_date DATE,
  ADD COLUMN has_social_insurance BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN paid_social_monthly DECIMAL(10,2),
  ADD COLUMN is_disabled BOOLEAN NOT NULL DEFAULT false;

-- Constraint: founding_date required when is_first_year = true
ALTER TABLE freelancer_profiles
  ADD CONSTRAINT chk_founding_date_required
  CHECK (is_first_year = false OR founding_date IS NOT NULL);
```

**Step 2: Commit**

```bash
git add supabase/migrations/20240101000055_freelancer_profile_insurance_fields.sql
git commit -m "feat: add insurance and first-year fields to freelancer_profiles

New columns: is_first_year, founding_date, has_social_insurance,
paid_social_monthly, is_disabled — needed for correct 2026 tax calculations"
```

---

## Task 5: Update Types Package — FreelancerProfile DB Type

**Files:**
- Modify: `packages/types/src/index.ts`

**Step 1: Update the `FreelancerProfile` interface to include new DB columns**

Find the existing `FreelancerProfile` interface (around line 47-54) and update:

```typescript
export interface FreelancerProfile {
  id: string
  organization_id: string
  ico: string | null
  tax_regime: TaxRegime
  registered_dph: boolean
  is_first_year: boolean
  founding_date: string | null
  has_social_insurance: boolean
  paid_social_monthly: number | null
  is_disabled: boolean
  created_at: string
}
```

**Step 2: Run type check**

```bash
cd packages/utils && pnpm run type-check
```

**Step 3: Commit**

```bash
git add packages/types/src/index.ts
git commit -m "feat: add new freelancer_profiles columns to FreelancerProfile type"
```

---

## Task 6: Update Onboarding Wizard — Živnostník Setup Steps

**Files:**
- Modify: `apps/web/src/components/onboarding/onboarding-wizard.tsx`
- Modify: `apps/web/src/app/(dashboard)/onboarding/page.tsx`

**Step 1: Add new form fields to the onboarding step that creates freelancer_profiles**

In `onboarding/page.tsx`, find the freelancer_profiles insert (around line 205-208) and extend it to save the new fields. The UI for these fields should be added in the wizard component.

**Step 2: Add a new wizard step for insurance/tax details**

In `onboarding-wizard.tsx`, add a new step between the current steps that asks:

1. "Ste platca DPH?" → toggle (may already exist via `registered_dph`)
2. "Je toto váš prvý rok podnikania?" → toggle
   - If yes: date picker for founding_date
   - Info banner: "Zdravotné poistenie je povinné od začiatku podnikania. Sociálne poistenie sa stáva povinným až od 1.7. roka nasledujúceho po roku, v ktorom ste podali prvé daňové priznanie."
3. "Bola vám určená výška sociálnych odvodov?" → toggle (only shown if not first year)
   - If yes: number input for paid_social_monthly
   - Info banner showing calculated vs entered amount
4. "Ste osoba so zdravotným postihnutím?" → toggle

Each field saves to the `freelancer_profiles` table via Supabase update.

**Step 3: Save the profile data**

Update the Supabase upsert call to include new fields:
```typescript
const { error: profileError } = await supabase
  .from('freelancer_profiles')
  .upsert({
    organization_id: orgId,
    tax_regime: taxRegime,
    registered_dph: isDphPayer,
    is_first_year: isFirstYear,
    founding_date: isFirstYear ? foundingDate : null,
    has_social_insurance: hasSocialInsurance,
    paid_social_monthly: hasSocialInsurance ? paidSocialMonthly : null,
    is_disabled: isDisabled,
  }, { onConflict: 'organization_id' })
```

**Step 4: Test manually**

1. Navigate to /onboarding
2. Select "Živnostník"
3. Fill org details, proceed
4. Verify new insurance/tax step appears
5. Toggle first year → verify date picker appears
6. Toggle social insurance → verify amount input appears
7. Complete wizard → verify data saved in freelancer_profiles

**Step 5: Commit**

```bash
git add apps/web/src/components/onboarding/onboarding-wizard.tsx apps/web/src/app/(dashboard)/onboarding/page.tsx
git commit -m "feat: add insurance and first-year questions to živnostník onboarding

- DPH status, first year toggle with founding date
- Social insurance status with manual amount override
- Disability toggle for reduced health rate
- Info banners explaining insurance obligations"
```

---

## Task 7: Update Freelancer Tax Data Fetcher

**Files:**
- Modify: `apps/web/src/lib/data/freelancer-tax.ts`

**Step 1: Update to use new tax engine**

Replace the import and calculation logic:

```typescript
import {
  SLOVAK_TAX_LEGISLATION_2026,
  getLegislation,
  calculateFreelancerTaxV2,
} from '@vexera/utils'
import type { FreelancerTaxProfile } from '@vexera/types'
```

Update `getFreelancerTaxData` to:
1. Fetch `freelancer_profiles` with the new columns (`is_first_year`, `founding_date`, `has_social_insurance`, `paid_social_monthly`, `is_disabled`, `registered_dph`)
2. Build a `FreelancerTaxProfile` from the DB data
3. Call `calculateFreelancerTaxV2` instead of `calculateFreelancerTax`

**Step 2: Test manually**

Navigate to the tax dashboard → verify the income tax estimate shows correct 2026 values.

**Step 3: Commit**

```bash
git add apps/web/src/lib/data/freelancer-tax.ts
git commit -m "feat: use new 2026 tax engine in freelancer tax data fetcher"
```

---

## Task 8: Invoice VAT Validation

**Files:**
- Modify: `apps/web/src/lib/validations/invoice.schema.ts`
- Modify: `apps/web/src/components/invoices/invoice-items-editor.tsx`

**Step 1: Add VAT validation based on DPH status**

In `invoice.schema.ts`, add a refinement or helper:

```typescript
export function getAvailableVatRates(isDphRegistered: boolean): readonly VatRate[] {
  if (!isDphRegistered) return [0] as const
  return SLOVAK_VAT_RATES
}
```

**Step 2: Enforce in invoice items editor**

In `invoice-items-editor.tsx`, accept an `isDphRegistered` prop. When `false`:
- Set all VAT rate selectors to 0% and disable them
- Show info banner: "Nie ste platca DPH. Všetky položky sú bez DPH."

When `true`:
- Allow all VAT rates as before
- Validate that org has `ic_dph` filled

**Step 3: Guard VAT returns for non-DPH orgs**

In `apps/web/src/lib/actions/vat-returns.ts`, add a check at the start of `computeVatReturnAction`:

```typescript
// Check if org is DPH registered before computing
const { data: org } = await supabase
  .from('organizations')
  .select('id')
  .eq('id', orgId)
  .single()

// Check freelancer or company profile for DPH status
const { data: freelancerProfile } = await supabase
  .from('freelancer_profiles')
  .select('registered_dph')
  .eq('organization_id', orgId)
  .single()

if (freelancerProfile && !freelancerProfile.registered_dph) {
  return { error: 'Organizácia nie je platcom DPH' }
}
```

**Step 4: Test manually**

1. Create invoice as non-DPH org → verify all items forced to 0% VAT
2. Create invoice as DPH org → verify all rates available
3. Try to compute VAT return for non-DPH org → verify error returned

**Step 5: Commit**

```bash
git add apps/web/src/lib/validations/invoice.schema.ts apps/web/src/components/invoices/invoice-items-editor.tsx apps/web/src/lib/actions/vat-returns.ts
git commit -m "feat: enforce VAT rules based on DPH registration status

- Non-DPH orgs: force 0% VAT on all invoice items
- DPH orgs: validate ic_dph format
- Block VAT return computation for non-DPH orgs"
```

---

## Task 9: Final Verification & Cleanup

**Step 1: Run all tests**

```bash
cd packages/utils && pnpm run test
```

Expected: All tests pass.

**Step 2: Run type check across the project**

```bash
cd packages/utils && pnpm run type-check
cd apps/web && pnpm run type-check
```

Expected: No type errors.

**Step 3: Verify key scenarios manually**

| Scenario | Expected |
|----------|----------|
| 30k income, paušálne, non-DPH | 15% tax, min insurance (303.11 social, 121.92 health) |
| 120k income, paušálne | Progressive brackets (19/25/30/35%), NOT 15% |
| First-year SZČO | Social = 0, health = mandatory |
| Income ≤ 9,144 | Osobitný základ: social = 131.34/month |
| ZD > 26,367.26 | Nezdaniteľná časť reduced by formula |
| ZD > ~50,234 | Nezdaniteľná časť = 0 |
| Disabled person | Health rate 8% instead of 16% |
| Non-DPH invoice | All items 0% VAT, no VAT return |

**Step 4: Final commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address review findings from tax engine verification"
```
