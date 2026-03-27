import { Skeleton } from "@/shared/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table"

const COLUMN_WIDTHS = ["w-24", "w-24", "w-40", "w-20", "w-48", "w-24", "w-20"]

export default function BankLoading() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div>
        <Skeleton className="h-9 w-24" />
        <Skeleton className="h-4 w-64 mt-2" />
      </div>

      {/* Tabs skeleton */}
      <div className="flex gap-2 border-b">
        <Skeleton className="h-9 w-28 mb-0" />
        <Skeleton className="h-9 w-20 mb-0" />
        <Skeleton className="h-9 w-24 mb-0" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-48" />
        <Skeleton className="h-9 w-44" />
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
            {Array.from({ length: 8 }).map((_, i) => (
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
