/** Format a number as EUR currency string */
export function formatEur(amount: number): string {
  return new Intl.NumberFormat('sk-SK', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/** Format a number with 2 decimal places (no currency symbol) */
export function formatDecimal(amount: number): string {
  return new Intl.NumberFormat('sk-SK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Parse a decimal string from DB (stored as string in JSON transport) to number.
 * Always use this instead of parseFloat for monetary values.
 */
export function parseMonetary(value: string | number): number {
  if (typeof value === 'number') return value
  const parsed = Number(value)
  if (Number.isNaN(parsed)) {
    throw new Error(`Invalid monetary value: ${value}`)
  }
  return parsed
}
