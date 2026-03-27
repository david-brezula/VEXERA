"use client"

import { useQuery } from "@tanstack/react-query"
import { Badge } from "@/shared/components/ui/badge"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/shared/components/ui/tooltip"
import { Mail, MailOpen, MailX, Clock } from "lucide-react"

interface EmailTrackingRecord {
  status: string
  recipient_email: string
  sent_at: string | null
  opened_at: string | null
  open_count: number
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error("Failed to fetch")
  return res.json() as Promise<T>
}

interface EmailTrackingBadgeProps {
  invoiceId: string
}

export function EmailTrackingBadge({ invoiceId }: EmailTrackingBadgeProps) {
  const { data: tracking } = useQuery({
    queryKey: ["email-tracking", invoiceId],
    queryFn: async () => {
      const result = await fetchJson<{ data: EmailTrackingRecord[] }>(
        `/api/email/tracking?invoice_id=${invoiceId}`
      )
      return result.data
    },
    enabled: !!invoiceId,
  })

  if (!tracking || tracking.length === 0) return null

  // Show the latest tracking record
  const latest = tracking[0]

  const statusConfig = {
    pending: { icon: Clock, label: "Čaká na odoslanie", variant: "secondary" as const },
    sent: { icon: Mail, label: "Odoslané", variant: "secondary" as const },
    delivered: { icon: Mail, label: "Doručené", variant: "outline" as const },
    opened: { icon: MailOpen, label: "Otvorené", variant: "default" as const },
    failed: { icon: MailX, label: "Zlyhanie", variant: "destructive" as const },
  }

  const config = statusConfig[latest.status as keyof typeof statusConfig] ?? statusConfig.sent
  const Icon = config.icon

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge variant={config.variant} className="gap-1 cursor-default">
          <Icon className="h-3 w-3" />
          {config.label}
          {latest.open_count > 1 && (
            <span className="ml-0.5">({latest.open_count}x)</span>
          )}
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <div className="text-xs space-y-1">
          <p>Príjemca: {latest.recipient_email}</p>
          {latest.sent_at && (
            <p>Odoslané: {new Date(latest.sent_at).toLocaleString("sk-SK")}</p>
          )}
          {latest.opened_at && (
            <p>Otvorené: {new Date(latest.opened_at).toLocaleString("sk-SK")}</p>
          )}
          {latest.open_count > 0 && <p>Počet otvorení: {latest.open_count}</p>}
        </div>
      </TooltipContent>
    </Tooltip>
  )
}
