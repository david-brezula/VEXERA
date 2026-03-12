import { describe, it, expect } from "vitest"
import {
  calculateFreelancerTax,
  calculateFlatExpenses,
  SLOVAK_TAX_CONFIG_2025,
} from "./tax"

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

describe("progressive tax brackets", () => {
  it("applies 15% for taxBase under threshold1", () => {
    // Use paidInsurance = 0 and high income with high expenses to control taxBase
    const result = calculateFreelancerTax(60000, 0, false, {
      ...cfg,
      nezdanitelnaČiastka: 0,
    }, { social: 0, health: 0 })
    // profit = 60000, insurance = 0, nezdanitelna = 0, taxBase = 60000
    // 49790 * 0.15 + (60000 - 49790) * 0.19
    const expected = Math.round((49790 * 0.15 + 10210 * 0.19) * 100) / 100
    expect(result.estimatedTax).toBe(expected)
  })

  it("applies all three brackets for very high income", () => {
    const result = calculateFreelancerTax(200000, 0, false, {
      ...cfg,
      nezdanitelnaČiastka: 0,
    }, { social: 0, health: 0 })
    // taxBase = 200000
    // 49790 * 0.15 + (176304 - 49790) * 0.19 + (200000 - 176304) * 0.25
    const part1 = 49790 * 0.15
    const part2 = (176304 - 49790) * 0.19
    const part3 = (200000 - 176304) * 0.25
    const expected = Math.round((part1 + part2 + part3) * 100) / 100
    expect(result.estimatedTax).toBe(expected)
  })
})
