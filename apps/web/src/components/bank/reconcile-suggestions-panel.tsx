"use client"

import { LinkIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { useManualMatch } from "@/hooks/use-bank"
import type { ReconcileResult } from "@/hooks/use-bank"
import type { ReconcileMatch, MatchConfidence } from "@/lib/services/reconciliation.service"

interface ReconcileSuggestionsPanelProps {
  result: ReconcileResult | null
}

function confidenceBadge(confidence: MatchConfidence) {
  if (confidence === "high") return <Badge className="bg-green-500 text-white">High</Badge>
  if (confidence === "medium") return <Badge className="bg-yellow-500 text-white">Medium</Badge>
  return <Badge variant="outline">Low</Badge>
}

function SuggestionRow({ match }: { match: ReconcileMatch }) {
  const manualMatch = useManualMatch()

  return (
    <div className="flex items-center gap-4 py-3 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          Transaction {match.transaction_id.slice(0, 8)}
        </p>
        <p className="text-xs text-muted-foreground">
          {match.transaction_amount.toFixed(2)} EUR
        </p>
      </div>
      <LinkIcon className="size-4 text-muted-foreground flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">
          {match.invoice_number ?? `Invoice ${match.invoice_id.slice(0, 8)}`}
        </p>
        <p className="text-xs text-muted-foreground">
          {match.invoice_total.toFixed(2)} EUR
        </p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {confidenceBadge(match.confidence)}
        <Button
          size="sm"
          variant="outline"
          disabled={manualMatch.isPending}
          onClick={() =>
            manualMatch.mutate({
              transactionId: match.transaction_id,
              invoiceId: match.invoice_id,
            })
          }
        >
          Match
        </Button>
      </div>
    </div>
  )
}

export function ReconcileSuggestionsPanel({ result }: ReconcileSuggestionsPanelProps) {
  if (!result) {
    return (
      <div className="rounded-lg border py-16 text-center text-muted-foreground text-sm">
        Run auto-reconcile to see suggestions
      </div>
    )
  }

  if (result.suggestions.length === 0) {
    return (
      <div className="rounded-lg border py-16 text-center text-sm">
        <p className="font-medium">No pending suggestions</p>
        <p className="text-muted-foreground mt-1">
          {result.reconciled > 0
            ? `${result.reconciled} transactions were auto-matched with high confidence.`
            : "No matches found. Import more transactions or check invoice dates."}
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm text-muted-foreground">
        {result.suggestions.length} suggestion
        {result.suggestions.length !== 1 ? "s" : ""} need manual review
        {result.reconciled > 0 && ` · ${result.reconciled} auto-matched`}
      </p>
      <div className="rounded-lg border px-4">
        {result.suggestions.map((match, i) => (
          <SuggestionRow key={`${match.transaction_id}-${i}`} match={match} />
        ))}
      </div>
    </div>
  )
}
