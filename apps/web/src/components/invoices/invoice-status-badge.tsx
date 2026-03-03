import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { InvoiceStatus } from "@vexera/types"

const STATUS_CONFIG: Record<
  InvoiceStatus | "overdue",
  { label: string; className: string }
> = {
  draft: {
    label: "Draft",
    className: "bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200",
  },
  sent: {
    label: "Sent",
    className: "bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200",
  },
  paid: {
    label: "Paid",
    className: "bg-green-100 text-green-700 hover:bg-green-100 border-green-200",
  },
  overdue: {
    label: "Overdue",
    className: "bg-red-100 text-red-700 hover:bg-red-100 border-red-200",
  },
  cancelled: {
    label: "Cancelled",
    className: "bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200",
  },
  closed: {
    label: "Closed",
    className: "bg-purple-100 text-purple-700 hover:bg-purple-100 border-purple-200",
  },
}

type Props = {
  status: InvoiceStatus | "overdue"
  className?: string
}

export function InvoiceStatusBadge({ status, className }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", config.className, className)}
    >
      {config.label}
    </Badge>
  )
}
