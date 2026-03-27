"use client"

import { useEffect, useState, useTransition } from "react"
import { getPatternCountAction } from "@/features/rules/actions-patterns"

export function BankPatternBadge() {
  const [count, setCount] = useState(0)
  const [, startTransition] = useTransition()

  useEffect(() => {
    startTransition(async () => {
      const result = await getPatternCountAction()
      setCount(result)
    })
  }, [])

  if (count <= 0) return null

  return (
    <span className="bg-primary text-primary-foreground rounded-full px-1.5 py-0.5 text-xs">
      {count}
    </span>
  )
}
