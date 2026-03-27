"use client"

import { useState, useEffect, useTransition } from "react"
import { format } from "date-fns"
import { BanknoteIcon, Loader2Icon } from "lucide-react"
import { toast } from "sonner"

import { useBankTransactions, useIgnoreTransaction } from "../hooks"
import { getSuggestionsAction } from "@/features/rules/actions-categorization"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table"
import { cn } from "@/lib/utils"
import type { BankTransaction, BankTransactionMatchStatus } from "@vexera/types"

// ─── Types ────────────────────────────────────────────────────────────────────

type Props = {
  matchStatus?: string
  bankAccountId?: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amount)
}

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  BankTransactionMatchStatus,
  { label: string; className: string }
> = {
  unmatched: {
    label: "Nespárované",
    className: "border-yellow-300 bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-300",
  },
  matched: {
    label: "Spárované",
    className: "border-green-300 bg-green-50 text-green-800 dark:bg-green-950 dark:text-green-300",
  },
  manually_matched: {
    label: "Manuálne spárované",
    className: "border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  },
  ignored: {
    label: "Ignorované",
    className: "border-gray-300 bg-gray-50 text-gray-600 dark:bg-gray-950 dark:text-gray-400",
  },
}

function MatchStatusBadge({ status }: { status: BankTransactionMatchStatus }) {
  const config = STATUS_CONFIG[status]
  return (
    <Badge
      variant="outline"
      className={cn("text-xs whitespace-nowrap", config.className)}
    >
      {config.label}
    </Badge>
  )
}

// ─── Actions cell ─────────────────────────────────────────────────────────────

function IgnoreButton({ transaction }: { transaction: BankTransaction }) {
  const ignoreTransaction = useIgnoreTransaction()

  async function handleIgnore() {
    try {
      await ignoreTransaction.mutateAsync({ transactionId: transaction.id })
    } catch {
      // Error handled by hook
    }
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleIgnore}
      disabled={ignoreTransaction.isPending}
      className="h-7 text-xs text-muted-foreground hover:text-foreground"
    >
      {ignoreTransaction.isPending ? (
        <Loader2Icon className="size-3 animate-spin" />
      ) : null}
      Ignorovať
    </Button>
  )
}

// ─── Transaction category suggestion (inline, informational only) ─────────────

function TransactionCategorySuggestion({
  counterpartName,
  amount,
}: {
  counterpartName: string | null
  amount: number | null
}) {
  const [label, setLabel] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false

    startTransition(async () => {
      const results = await getSuggestionsAction({
        supplier_name: counterpartName,
        total_amount: amount,
        description: null,
      })
      if (!cancelled && results.length > 0) {
        const top = results[0]
        setLabel(`Návrh: ${top.category} (${Math.round(top.confidence * 100)}%)`)
      }
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [counterpartName, amount])

  if (!label) return null

  return (
    <span className="block text-xs text-muted-foreground/70 mt-0.5 italic">
      {label}
    </span>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function BankTransactionsTable({ matchStatus, bankAccountId }: Props) {
  const { data: transactions = [], isLoading, error } = useBankTransactions({
    match_status: matchStatus,
  })

  // Filter by account client-side (hook doesn't accept bank_account_id param directly)
  const filteredTransactions = bankAccountId
    ? transactions.filter((tx) => tx.bank_account_id === bankAccountId)
    : transactions

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2Icon className="size-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12 text-center">
        <p className="text-sm text-destructive">Nepodarilo sa načítať transakcie</p>
      </div>
    )
  }

  if (filteredTransactions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-16 text-center">
        <BanknoteIcon className="size-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold">Žiadne transakcie</h3>
        <p className="text-sm text-muted-foreground mt-1">
          {matchStatus || bankAccountId
            ? "Skúste upraviť filtre."
            : "Importujte bankový výpis."}
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-md border bg-card backdrop-blur-xl">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Dátum</TableHead>
            <TableHead className="text-right">Suma</TableHead>
            <TableHead>Protiúčet</TableHead>
            <TableHead>VS</TableHead>
            <TableHead>Popis</TableHead>
            <TableHead>Stav</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredTransactions.map((tx) => (
            <TableRow key={tx.id}>
              {/* Date */}
              <TableCell className="whitespace-nowrap text-sm">
                {format(new Date(tx.transaction_date), "dd.MM.yyyy")}
              </TableCell>

              {/* Amount */}
              <TableCell className="text-right tabular-nums font-medium text-sm whitespace-nowrap">
                <span
                  className={cn(
                    tx.amount >= 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"
                  )}
                >
                  {formatAmount(tx.amount, tx.currency)}
                </span>
              </TableCell>

              {/* Counterpart */}
              <TableCell className="text-sm max-w-[160px]">
                {tx.counterpart_name ? (
                  <span className="truncate block" title={tx.counterpart_name}>
                    {tx.counterpart_name}
                  </span>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </TableCell>

              {/* Variable symbol */}
              <TableCell className="text-sm font-mono">
                {tx.variable_symbol ?? <span className="text-muted-foreground">—</span>}
              </TableCell>

              {/* Description */}
              <TableCell className="text-sm text-muted-foreground max-w-[200px]">
                {tx.description ? (
                  <span className="truncate block" title={tx.description}>
                    {tx.description}
                  </span>
                ) : (
                  "—"
                )}
                {tx.match_status === "unmatched" && (
                  <TransactionCategorySuggestion
                    counterpartName={tx.counterpart_name}
                    amount={tx.amount}
                  />
                )}
              </TableCell>

              {/* Status */}
              <TableCell>
                <MatchStatusBadge status={tx.match_status} />
              </TableCell>

              {/* Actions */}
              <TableCell>
                {tx.match_status === "unmatched" && (
                  <IgnoreButton transaction={tx} />
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
