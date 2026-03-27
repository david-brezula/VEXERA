import type { SupabaseClient } from "@supabase/supabase-js"

export interface DetectedPattern {
  id: string
  counterpartyName: string
  counterpartyIban: string | null
  averageAmount: number
  frequency: "weekly" | "monthly" | "quarterly"
  confidence: number
  matchCount: number
  lastOccurrence: string
  transactionIds: string[]
}

interface BankTxRow {
  id: string
  transaction_date: string
  amount: number
  counterpart_name: string | null
  counterpart_iban: string | null
  description: string | null
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
    ((org as { dismissed_recurring_patterns?: string[] })?.dismissed_recurring_patterns ?? []) as string[]
  )

  // Group by counterparty name
  const typedTxs = transactions as BankTxRow[]
  const groups = new Map<string, BankTxRow[]>()
  for (const tx of typedTxs) {
    const key = (tx.counterpart_name ?? "").toLowerCase().trim()
    if (!key) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(tx)
  }

  const patterns: DetectedPattern[] = []

  for (const [, txs] of groups) {
    if (txs.length < 3) continue

    const amounts = txs.map((t) => Math.abs(Number(t.amount)))
    amounts.sort((a, b) => a - b)
    const median = amounts[Math.floor(amounts.length / 2)]
    const consistent = amounts.filter(a => Math.abs(a - median) / median <= 0.05)
    if (consistent.length < 3) continue

    const dates = txs.map((t) => new Date(t.transaction_date).getTime()).sort()
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

    const intervalVariance = intervals.reduce((sum, i) => sum + Math.abs(i - avgInterval), 0) / intervals.length
    const intervalScore = Math.max(0, 1 - intervalVariance / avgInterval)
    const amountScore = consistent.length / amounts.length
    const countScore = Math.min(txs.length / 6, 1)
    const confidence = (intervalScore * 0.4 + amountScore * 0.3 + countScore * 0.3)

    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length
    const id = hashPattern(txs[0].counterpart_name ?? "", Math.round(avg))

    if (dismissed.has(id)) continue

    patterns.push({
      id,
      counterpartyName: txs[0].counterpart_name ?? "",
      counterpartyIban: txs[0].counterpart_iban ?? null,
      averageAmount: Math.round(avg * 100) / 100,
      frequency,
      confidence: Math.round(confidence * 100) / 100,
      matchCount: txs.length,
      lastOccurrence: txs[txs.length - 1].transaction_date,
      transactionIds: txs.map((t) => t.id),
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
