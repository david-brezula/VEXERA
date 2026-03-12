"use client"

import { Button } from "@/components/ui/button"

const SUGGESTIONS = [
  "Aké sú moje celkové náklady za posledný mesiac?",
  "Koľko mám nezaplatených faktúr?",
  "Aké sú moje tržby za posledný kvartál?",
  "Kto je môj najväčší dodávateľ?",
  "Aký je prehľad mojich výdavkov podľa kategórií?",
]

interface ChatSuggestionChipsProps {
  onSelect: (suggestion: string) => void
  disabled?: boolean
}

export function ChatSuggestionChips({ onSelect, disabled }: ChatSuggestionChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {SUGGESTIONS.map((suggestion) => (
        <Button
          key={suggestion}
          variant="outline"
          size="sm"
          className="h-auto py-1.5 px-3 text-xs whitespace-normal text-left"
          onClick={() => onSelect(suggestion)}
          disabled={disabled}
        >
          {suggestion}
        </Button>
      ))}
    </div>
  )
}
