// Slovak freelancer tax calculations
// All rates are passed via TaxConfig so they can be updated each fiscal year.

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
  expenseDeduction: number
  taxBase: number
  estimatedTax: number
  socialMonthly: number
  healthMonthly: number
  nextYearSocialMonthly: number
  nextYearHealthMonthly: number
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

export function calculateFlatExpenses(income: number, config: TaxConfig): number {
  return Math.min(income * config.flatExpenseRate, config.flatExpenseCap)
}

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

  return {
    expenseDeduction: round2(expenseDeduction),
    taxBase: round2(taxBase),
    estimatedTax,
    socialMonthly,
    healthMonthly,
    nextYearSocialMonthly: socialMonthly,
    nextYearHealthMonthly: healthMonthly,
  }
}
