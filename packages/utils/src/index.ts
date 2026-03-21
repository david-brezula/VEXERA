export {
  SLOVAK_VAT_RATES,
  DEFAULT_VAT_RATE,
  calculateVatAmount,
  calculateGrossAmount,
  calculateNetFromGross,
  formatVatRate,
} from './vat'

export {
  formatEur,
  formatDecimal,
  parseMonetary,
} from './currency'

export {
  // Legacy (deprecated)
  SLOVAK_TAX_CONFIG_2025,
  SLOVAK_TAX_CONFIG_2026,
  calculateFreelancerTax,
  // New 2026 engine
  SLOVAK_TAX_LEGISLATION_2026,
  getLegislation,
  calculateFlatExpenses,
  calculateNezdanitelnaCiastka,
  calculateProgressiveTax,
  calculateTaxAmount,
  calculateInsurance,
  calculateFreelancerTaxV2,
} from './tax'
export type {
  TaxConfig,
  FreelancerTaxResult,
  SlovakTaxLegislation,
  FreelancerTaxProfile,
  FreelancerTaxResultV2,
} from './tax'
