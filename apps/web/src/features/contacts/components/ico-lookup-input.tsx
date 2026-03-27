"use client"

import { useState } from "react"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Loader2, Search } from "lucide-react"
import { useLookupICO } from "../hooks"

interface ICOLookupInputProps {
  value: string
  onChange: (value: string) => void
  onLookupResult: (data: Record<string, unknown>) => void
}

export function ICOLookupInput({ value, onChange, onLookupResult }: ICOLookupInputProps) {
  const [localValue, setLocalValue] = useState(value)
  const lookup = useLookupICO()

  const handleChange = (v: string) => {
    setLocalValue(v)
    onChange(v)
  }

  const handleLookup = async () => {
    if (!localValue.trim()) return
    const result = await lookup.mutateAsync(localValue.trim())
    onLookupResult(result)
  }

  return (
    <div className="flex gap-2">
      <Input
        value={localValue}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Zadajte IČO pre automatické vyplnenie"
      />
      <Button
        type="button"
        variant="outline"
        size="icon"
        onClick={handleLookup}
        disabled={lookup.isPending || !localValue.trim()}
        title="Vyhľadať v registri"
      >
        {lookup.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Search className="h-4 w-4" />
        )}
      </Button>
    </div>
  )
}
