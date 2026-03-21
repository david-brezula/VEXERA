// Slovak freelancer tax calculations — 2026 legislation
// Sources:
//   https://www.podnikajte.sk/dan-z-prijmov/nezdanitelne-casti-zakladu-dane-2026
//   https://www.podnikajte.sk/socialne-a-zdravotne-odvody/minimalne-odvody-szco-od-1-1-2026
//   https://www.podnikajte.sk/dan-z-prijmov/progresivne-zdanenie-prijmov-fyzickych-osob-od-2026

import type {
  SlovakTaxLegislation,
  FreelancerTaxProfile,
  FreelancerTaxResultV2,
  TaxBracket,
  NezdanitelnaConfig,
} from '@vexera/types'

// Re-export types used by consumers
export type { SlovakTaxLegislation, FreelancerTaxProfile, FreelancerTaxResultV2 }

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

export interface FreelancerTaxResult {
  expenseDeduction: number
  insuranceDeduction: number
  taxBase: number
  estimatedTax: number
  socialMonthly: number
  healthMonthly: number
  nextYearSocialMonthly: number
  nextYearHealthMonthly: number
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
    minSocialMonthly: 303.11,
    minHealthMonthly: 121.92,
    minHealthMonthlyDisabled: 60.96,
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

// --- New calculation functions ---

export function calculateFlatExpenses(income: number, config: SlovakTaxLegislation | TaxConfig): number {
  return Math.min(income * config.flatExpenseRate, config.flatExpenseCap)
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
    const minHealth = profile.isDisabled ? ins.minHealthMonthlyDisabled : ins.minHealthMonthly
    return {
      socialMonthly: 0,
      healthMonthly: minHealth,
    }
  }

  // Calculate vymeriavací základ from profit
  const expenseDeduction = profile.taxRegime === 'pausalne_vydavky'
    ? Math.min(income * legislation.flatExpenseRate, legislation.flatExpenseCap)
    : expenses
  const profit = Math.max(0, income - expenseDeduction)
  const annualAssessmentBase = profit / 1.486
  const monthlyBase = annualAssessmentBase / legislation.assessmentMonths

  const minHealth = profile.isDisabled ? ins.minHealthMonthlyDisabled : ins.minHealthMonthly

  // Low-income SZČO → osobitný vymeriavací základ
  if (income <= ins.osobitnyIncomeThreshold) {
    return {
      socialMonthly: round2(ins.osobitnyVymeriavaciZaklad * ins.socialRate),
      healthMonthly: Math.max(
        minHealth,
        round2(ins.osobitnyVymeriavaciZaklad * healthRate),
      ),
    }
  }

  // Calculate from vymeriavací základ, clamp to max
  const clampedBase = Math.min(monthlyBase, ins.maxVymeriavaciZaklad)

  return {
    socialMonthly: Math.max(ins.minSocialMonthly, round2(clampedBase * ins.socialRate)),
    healthMonthly: Math.max(minHealth, round2(clampedBase * healthRate)),
  }
}

export function calculateFreelancerTaxV2(
  income: number,
  expenses: number,
  profile: FreelancerTaxProfile,
  legislation: SlovakTaxLegislation,
): FreelancerTaxResultV2 {
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
): FreelancerTaxResult {
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
