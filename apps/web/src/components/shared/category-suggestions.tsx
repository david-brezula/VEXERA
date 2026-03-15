"use client"

import { useState, useEffect, useTransition } from "react"
import { CheckIcon, XIcon, SparklesIcon } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import {
  getSuggestionsAction,
  acceptSuggestionAction,
  dismissSuggestionAction,
} from "@/lib/actions/categorization"

type Suggestion = {
  category: string
  account_number: string
  confidence: number
}

type Props = {
  documentId: string
  supplierName: string | null
  totalAmount: number | null
  description: string | null
  onAccepted?: (category: string) => void
}

export function CategorySuggestions({
  documentId,
  supplierName,
  totalAmount,
  description,
  onAccepted,
}: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [loaded, setLoaded] = useState(false)
  const [isPending, startTransition] = useTransition()

  useEffect(() => {
    let cancelled = false

    startTransition(async () => {
      const result = await getSuggestionsAction({
        supplier_name: supplierName,
        total_amount: totalAmount,
        description: description,
      })
      if (!cancelled) {
        setSuggestions(result)
        setLoaded(true)
      }
    })

    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supplierName, totalAmount, description])

  function handleAccept(suggestion: Suggestion) {
    startTransition(async () => {
      const result = await acceptSuggestionAction(
        documentId,
        suggestion.category,
        suggestion.account_number
      )
      if (!result.error) {
        setSuggestions((prev) => prev.filter((s) => s.category !== suggestion.category))
        onAccepted?.(suggestion.category)
      }
    })
  }

  function handleDismiss(suggestion: Suggestion) {
    startTransition(async () => {
      await dismissSuggestionAction(documentId, suggestion.category)
      setSuggestions((prev) => prev.filter((s) => s.category !== suggestion.category))
    })
  }

  if (!loaded || suggestions.length === 0) return null

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
        <SparklesIcon className="h-3.5 w-3.5" />
        Suggestions:
      </span>
      {suggestions.map((suggestion) => (
        <span key={suggestion.category} className="inline-flex items-center gap-0.5">
          <Badge
            variant="outline"
            className="cursor-pointer gap-1 pr-1 hover:bg-accent"
            onClick={() => handleAccept(suggestion)}
          >
            <CheckIcon className="h-3 w-3" />
            {suggestion.category} ({Math.round(suggestion.confidence * 100)}%)
            <button
              type="button"
              className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20"
              onClick={(e) => {
                e.stopPropagation()
                handleDismiss(suggestion)
              }}
              disabled={isPending}
            >
              <XIcon className="h-3 w-3" />
              <span className="sr-only">Dismiss</span>
            </button>
          </Badge>
        </span>
      ))}
    </div>
  )
}
