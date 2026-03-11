"use client"

import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

interface RiskScoreBadgeProps {
  score: number
  issueCount?: number
  criticalCount?: number
}

export function RiskScoreBadge({ score, issueCount, criticalCount }: RiskScoreBadgeProps) {
  const variant =
    score >= 50 ? "destructive" :
    score >= 20 ? "outline" :
    "secondary"

  const label =
    score >= 50 ? "Vysoké riziko" :
    score >= 20 ? "Stredné riziko" :
    score > 0 ? "Nízke riziko" :
    "V poriadku"

  return (
    <Tooltip>
      <TooltipTrigger>
        <Badge variant={variant}>{label} ({score}%)</Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>{issueCount ?? 0} problémov ({criticalCount ?? 0} kritických)</p>
      </TooltipContent>
    </Tooltip>
  )
}
