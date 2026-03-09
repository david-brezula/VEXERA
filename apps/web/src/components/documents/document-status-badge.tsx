import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { DocumentStatus } from "@vexera/types"

const STATUS_CONFIG: Record<DocumentStatus, { label: string; className: string }> = {
  new: {
    label: "New",
    className: "bg-gray-100 text-gray-700 hover:bg-gray-100 border-gray-200",
  },
  auto_processed: {
    label: "Auto-processed",
    className: "bg-blue-100 text-blue-700 hover:bg-blue-100 border-blue-200",
  },
  awaiting_review: {
    label: "Awaiting review",
    className: "bg-yellow-100 text-yellow-700 hover:bg-yellow-100 border-yellow-200",
  },
  approved: {
    label: "Approved",
    className: "bg-green-100 text-green-700 hover:bg-green-100 border-green-200",
  },
  awaiting_client: {
    label: "Awaiting client",
    className: "bg-orange-100 text-orange-700 hover:bg-orange-100 border-orange-200",
  },
  archived: {
    label: "Archived",
    className: "bg-gray-100 text-gray-500 hover:bg-gray-100 border-gray-200",
  },
}

type Props = {
  status: DocumentStatus
  className?: string
}

export function DocumentStatusBadge({ status, className }: Props) {
  const config = STATUS_CONFIG[status] ?? STATUS_CONFIG.new
  return (
    <Badge
      variant="outline"
      className={cn("font-medium", config.className, className)}
    >
      {config.label}
    </Badge>
  )
}
