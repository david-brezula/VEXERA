"use client"

import { useEffect, useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { RepeatIcon, XIcon, PlusIcon } from "lucide-react"
import { formatEur } from "@vexera/utils"

import { Card, CardContent } from "@/shared/components/ui/card"
import { Badge } from "@/shared/components/ui/badge"
import { Button } from "@/shared/components/ui/button"
import { Separator } from "@/shared/components/ui/separator"
import {
  getDetectedPatternsAction,
  dismissPatternAction,
} from "@/features/rules/actions-patterns"
import type { DetectedPattern } from "@/features/rules/pattern-detection.service"

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
    weekly: "Týždenne",
    monthly: "Mesačne",
    quarterly: "Štvrťročne",
  }

  if (!loaded && isPending) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Analyzujem transakcie na opakujúce sa vzory...
      </p>
    )
  }

  if (patterns.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-8 text-center">
        Zatiaľ neboli zistené žiadne opakujúce sa vzory.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold">Zistené opakujúce sa vzory</h2>
        <p className="text-sm text-muted-foreground">
          Títo obchodní partneri majú opakujúce sa transakcie. Môžete z nich
          vytvoriť šablóny opakujúcich sa faktúr.
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
                <span>Na základe {pattern.matchCount} transakcií</span>
                <span>Posledná: {pattern.lastOccurrence}</span>
              </div>

              <div className="text-xs text-muted-foreground">
                Istota: {Math.round(pattern.confidence * 100)}%
              </div>

              <Separator />

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={() => handleCreateTemplate(pattern)}
                >
                  <PlusIcon className="size-4 mr-1" />
                  Vytvoriť šablónu
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => handleDismiss(pattern.id)}
                  disabled={isPending}
                >
                  <XIcon className="size-4 mr-1" />
                  Zamietnuť
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
