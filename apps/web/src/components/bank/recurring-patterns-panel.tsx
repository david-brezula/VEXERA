"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RepeatIcon, XIcon, PlusIcon } from "lucide-react"
import { formatEur } from "@vexera/utils"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  getDetectedPatternsAction,
  dismissPatternAction,
} from "@/lib/actions/patterns"
import type { DetectedPattern } from "@/lib/services/pattern-detection.service"

// ─── Props ────────────────────────────────────────────────────────────────────

interface RecurringPatternsPanelProps {
  onCountChange?: (count: number) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecurringPatternsPanel({ onCountChange }: RecurringPatternsPanelProps) {
  const router = useRouter()
  const [patterns, setPatterns] = useState<DetectedPattern[]>([])
  const [isPending, startTransition] = useTransition()
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    startTransition(async () => {
      const result = await getDetectedPatternsAction()
      setPatterns(result)
      setLoaded(true)
      onCountChange?.(result.length)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleDismiss(patternId: string) {
    startTransition(async () => {
      const { error } = await dismissPatternAction(patternId)
      if (!error) {
        const updated = patterns.filter((p) => p.id !== patternId)
        setPatterns(updated)
        onCountChange?.(updated.length)
      }
    })
  }

  function handleCreateTemplate(pattern: DetectedPattern) {
    const prefill = btoa(
      JSON.stringify({
        customerName: pattern.counterpartyName,
        amount: pattern.averageAmount,
        frequency: pattern.frequency,
      })
    )
    router.push(`/invoices/recurring?prefill=${prefill}`)
  }

  const frequencyLabel: Record<string, string> = {
    weekly: "Weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
  }

  if (!loaded && isPending) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Analyzing transactions for recurring patterns...
      </p>
    )
  }

  if (patterns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        No recurring patterns detected yet.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Detected Recurring Patterns</h2>
        <p className="text-sm text-muted-foreground">
          These counterparties appear to have recurring transactions. You can
          create recurring invoice templates from them.
        </p>
      </div>

      <Separator />

      <div className="grid gap-4 md:grid-cols-2">
        {patterns.map((pattern) => (
          <Card key={pattern.id}>
            <CardContent className="pt-6 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{pattern.counterpartyName}</p>
                  {pattern.counterpartyIban && (
                    <p className="text-xs text-muted-foreground">
                      {pattern.counterpartyIban}
                    </p>
                  )}
                </div>
                <Badge variant="secondary">
                  <RepeatIcon className="size-3 mr-1" />
                  {frequencyLabel[pattern.frequency]}
                </Badge>
              </div>

              <div className="text-2xl font-bold">
                {formatEur(pattern.averageAmount)}
              </div>

              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>Based on {pattern.matchCount} transactions</span>
                <span>Last: {pattern.lastOccurrence}</span>
              </div>

              <div className="text-xs text-muted-foreground">
                Confidence: {Math.round(pattern.confidence * 100)}%
              </div>

              <Separator />

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleCreateTemplate(pattern)}
                >
                  <PlusIcon className="size-4 mr-1" />
                  Create Recurring Template
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDismiss(pattern.id)}
                  disabled={isPending}
                >
                  <XIcon className="size-4 mr-1" />
                  Dismiss
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
