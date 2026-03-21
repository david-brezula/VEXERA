import { describe, it, expect } from "vitest"
import {
  calculateFreelancerTax,
  calculateFlatExpenses,
  SLOVAK_TAX_CONFIG_2025,
  SLOVAK_TAX_LEGISLATION_2026,
  calculateNezdanitelnaCiastka,
  calculateProgressiveTax,
  calculateTaxAmount,
  calculateInsurance,
  calculateFreelancerTaxV2,
  getLegislation,
} from "./tax"
import type { FreelancerTaxProfile } from "@vexera/types"

// --- Legacy tests (unchanged, using 2025 config) ---

const cfg = SLOVAK_TAX_CONFIG_2025

describe("calculateFlatExpenses", () => {
  it("returns 60% of income when under cap", () => {
    expect(calculateFlatExpenses(10000, cfg)).toBe(6000)
  })

  it("caps at 20 000 EUR", () => {
    expect(calculateFlatExpenses(50000, cfg)).toBe(20000)
  })
})

describe("calculateFreelancerTax — pausalne vydavky", () => {
  it("deducts insurance from tax base", () => {
    const result = calculateFreelancerTax(30000, 0, true, cfg)

    // income 30000, flat expenses 18000, profit 12000
    // assessment base = 12000/2 = 6000, monthly = 500
    // social = max(194.67, 500*0.3315=165.75) = 194.67 (minimum)
    // health = max(97.80, 500*0.14=70) = 97.80 (minimum)
    // annual insurance = (194.67 + 97.80) * 12 = 3509.64
    // tax base = 12000 - 3509.64 - 4922.82 = 3567.54
    expect(result.expenseDeduction).toBe(18000)
    expect(result.insuranceDeduction).toBe(3509.64)
    expect(result.taxBase).toBe(3567.54)
    expect(result.estimatedTax).toBeGreaterThan(0)
  })

  it("applies 15% rate for income in first bracket", () => {
    const result = calculateFreelancerTax(30000, 0, true, cfg)
    // taxBase 3567.54 is well under 49790, so 15% applies
    expect(result.estimatedTax).toBe(Math.round(3567.54 * 0.15 * 100) / 100)
  })

  it("insurance deduction can bring tax base to zero", () => {
    // Small income where profit < insurance + nezdanitelna
    const result = calculateFreelancerTax(5000, 0, true, cfg)
    // flat expenses = 3000, profit = 2000
    // min insurance = (194.67 + 97.80) * 12 = 3509.64
    // 2000 - 3509.64 - 4922.82 < 0 → 0
    expect(result.taxBase).toBe(0)
    expect(result.estimatedTax).toBe(0)
    expect(result.insuranceDeduction).toBeGreaterThan(0)
  })
})

describe("calculateFreelancerTax — skutocne naklady", () => {
  it("does not double-deduct insurance (insuranceDeduction = 0)", () => {
    const result = calculateFreelancerTax(30000, 10000, false, cfg)

    expect(result.expenseDeduction).toBe(10000)
    expect(result.insuranceDeduction).toBe(0)
    // tax base = max(0, 20000 - 0 - 4922.82) = 15077.18
    expect(result.taxBase).toBe(15077.18)
  })

  it("deducts explicit paidInsurance when provided", () => {
    const paid = { social: 2400, health: 1200 }
    const result = calculateFreelancerTax(30000, 10000, false, cfg, paid)

    expect(result.insuranceDeduction).toBe(3600)
    // tax base = max(0, 20000 - 3600 - 4922.82) = 11477.18
    expect(result.taxBase).toBe(11477.18)
  })
})

describe("calculateFreelancerTax — paidInsurance override", () => {
  it("overrides estimated insurance for pausalne vydavky too", () => {
    const paid = { social: 1000, health: 500 }
    const result = calculateFreelancerTax(30000, 0, true, cfg, paid)

    expect(result.insuranceDeduction).toBe(1500)
    // profit = 12000, taxBase = 12000 - 1500 - 4922.82 = 5577.18
    expect(result.taxBase).toBe(5577.18)
  })
})

describe("calculateFreelancerTax — edge cases", () => {
  it("handles zero income", () => {
    const result = calculateFreelancerTax(0, 0, true, cfg)
    expect(result.expenseDeduction).toBe(0)
    expect(result.insuranceDeduction).toBeGreaterThan(0) // minimum odvody
    expect(result.taxBase).toBe(0)
    expect(result.estimatedTax).toBe(0)
  })

  it("returns minimum monthly odvody for low income", () => {
    const result = calculateFreelancerTax(1000, 0, true, cfg)
    expect(result.socialMonthly).toBe(cfg.minSocialMonthly)
    expect(result.healthMonthly).toBe(cfg.minHealthMonthly)
  })
})

describe("progressive tax brackets (legacy)", () => {
  it("applies 19% flat when income > threshold1 and taxBase <= threshold2", () => {
    const result = calculateFreelancerTax(60000, 0, false, {
      ...cfg,
      nezdanitelnaČiastka: 0,
    }, { social: 0, health: 0 })
    // income 60000 > threshold1 49790 → skip 15%
    // taxBase 60000 <= threshold2 176304 → 19% flat
    expect(result.estimatedTax).toBe(Math.round(60000 * 0.19 * 100) / 100)
  })

  it("applies 19%/25% split for taxBase > threshold2", () => {
    const result = calculateFreelancerTax(200000, 0, false, {
      ...cfg,
      nezdanitelnaČiastka: 0,
    }, { social: 0, health: 0 })
    // income > threshold1 → skip 15%
    // taxBase 200000 > threshold2 176304 → split
    const part1 = 176304 * 0.19
    const part2 = (200000 - 176304) * 0.25
    const expected = Math.round((part1 + part2) * 100) / 100
    expect(result.estimatedTax).toBe(expected)
  })
})

// ============================================================
// NEW 2026 TAX ENGINE TESTS
// ============================================================

const leg = SLOVAK_TAX_LEGISLATION_2026

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
  it("has correct nezdaniteľná časť (5966.73)", () => {
    expect(leg.nezdanitelna.plnaCiastka).toBe(5966.73)
  })

  it("has correct health rate (16%)", () => {
    expect(leg.insurance.healthRate).toBe(0.16)
  })

  it("has correct min social monthly (303.11)", () => {
    expect(leg.insurance.minSocialMonthly).toBe(303.11)
  })

  it("has correct min health monthly (121.92)", () => {
    expect(leg.insurance.minHealthMonthly).toBe(121.92)
  })

  it("has 4 progressive brackets (19/25/30/35%)", () => {
    const b = leg.progressiveBrackets
    expect(b).toHaveLength(4)
    expect(b[0]!.rate).toBe(0.19)
    expect(b[1]!.rate).toBe(0.25)
    expect(b[2]!.rate).toBe(0.30)
    expect(b[3]!.rate).toBe(0.35)
    expect(b[3]!.upTo).toBeNull()
  })

  it("has correct osobitný vymeriavací základ", () => {
    expect(leg.insurance.osobitnyVymeriavaciZaklad).toBe(396.24)
    // 396.24 * 0.3315 = 131.3536 → rounds to 131.35 (exact calculation)
    const osobitnyOdvod = Math.round(396.24 * 0.3315 * 100) / 100
    expect(osobitnyOdvod).toBe(131.35)
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

  it("returns 0 for zero taxBase", () => {
    expect(calculateTaxAmount(0, 50000, leg)).toBe(0)
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
    // 396.24 * 0.3315 = 131.35 (rounded)
    expect(result.socialMonthly).toBe(
      Math.round(396.24 * 0.3315 * 100) / 100,
    )
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
    // osobitný základ: health = 396.24 * 0.08 = 31.70
    // but min disabled = 60.96 → max(60.96, 31.70) = 60.96
    expect(result.healthMonthly).toBe(60.96)
  })

  it("caps at max vymeriavací základ", () => {
    const profile = makeProfile()
    const result = calculateInsurance(500000, 0, profile, leg)
    const maxSocial = Math.round(16764 * 0.3315 * 100) / 100
    expect(result.socialMonthly).toBeLessThanOrEqual(maxSocial)
  })

  it("returns minimum insurance for standard income", () => {
    const profile = makeProfile()
    // Income above osobitný threshold but with low profit → min applies
    const result = calculateInsurance(15000, 0, profile, leg)
    expect(result.socialMonthly).toBeGreaterThanOrEqual(leg.insurance.minSocialMonthly)
    expect(result.healthMonthly).toBeGreaterThanOrEqual(leg.insurance.minHealthMonthly)
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
