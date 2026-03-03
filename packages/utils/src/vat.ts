import type { VatRate } from '@vexera/types'

/** Slovak VAT rates as of 2025 */
export const SLOVAK_VAT_RATES: readonly VatRate[] = [20, 10, 5, 0]

/** Default VAT rate in Slovakia */
export const DEFAULT_VAT_RATE: VatRate = 20

/** Calculate VAT amount from a net (excl. VAT) value */
export function calculateVatAmount(netAmount: number, vatRate: VatRate): number {
  return Math.round(netAmount * (vatRate / 100) * 100) / 100
}

/** Calculate gross (incl. VAT) from net amount */
export function calculateGrossAmount(netAmount: number, vatRate: VatRate): number {
  return Math.round((netAmount + calculateVatAmount(netAmount, vatRate)) * 100) / 100
}

/** Calculate net amount from gross (incl. VAT) */
export function calculateNetFromGross(grossAmount: number, vatRate: VatRate): number {
  if (vatRate === 0) return grossAmount
  return Math.round((grossAmount / (1 + vatRate / 100)) * 100) / 100
}

/** Format VAT rate for display */
export function formatVatRate(rate: VatRate): string {
  return `${rate}%`
}
