import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

const COLUMN_WIDTHS = ["w-24", "w-20", "w-40", "w-24", "w-24", "w-24", "w-20"]

export default function InvoicesLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-4 w-52 mt-2" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-36" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-9 w-40" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              {COLUMN_WIDTHS.map((w, i) => (
                <TableHead key={i}>
                  <Skeleton className={`h-4 ${w}`} />
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 6 }).map((_, i) => (
              <TableRow key={i}>
                {COLUMN_WIDTHS.map((w, j) => (
                  <TableCell key={j}>
                    <Skeleton className={`h-4 ${w}`} />
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
