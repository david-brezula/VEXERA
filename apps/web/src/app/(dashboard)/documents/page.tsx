import { Suspense } from "react"
import { FolderOpenIcon } from "lucide-react"

import { getDocuments, type DocumentFilters } from "@/lib/data/documents"
import { getActiveOrgId } from "@/lib/data/org"
import { DocumentsTableClient } from "@/components/documents/documents-table-client"
import { PaginationControls } from "@/components/ui/pagination-controls"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import type { DocumentStatus } from "@vexera/types"

// ─── Async data component ─────────────────────────────────────────────────────

async function DocumentsContent({
  filters,
  hasFilters,
  page,
}: {
  filters: DocumentFilters
  hasFilters: boolean
  page: number
}) {
  const result = await getDocuments(filters, { page })
  return (
    <>
      <DocumentsTableClient documents={result.data} hasFilters={hasFilters} />
      <PaginationControls page={result.page} totalPages={result.totalPages} total={result.total} />
    </>
  )
}

// ─── Table skeleton ──────────────────────────────────────────────────────────

const COLUMN_WIDTHS = ["w-8", "w-24", "w-40", "w-24", "w-24", "w-24"]

function DocumentsTableSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="h-9 w-44" />
          <Skeleton className="h-9 w-44" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DocumentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [params, orgId] = await Promise.all([searchParams, getActiveOrgId()])

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FolderOpenIcon className="size-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Select an organization to view documents</p>
      </div>
    )
  }

  const filters: DocumentFilters = {
    document_type: params.type as string | undefined,
    search: params.q as string | undefined,
    status: (params.status as DocumentStatus | "all") ?? "all",
    date_from: params.from as string | undefined,
    date_to: params.to as string | undefined,
  }
  const hasFilters = !!(
    filters.document_type ||
    filters.search ||
    (filters.status && filters.status !== "all") ||
    filters.date_from ||
    filters.date_to
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">
          Upload and manage accounting documents
        </p>
      </div>

      <Suspense fallback={<DocumentsTableSkeleton />}>
        <DocumentsContent filters={filters} hasFilters={hasFilters} page={Number(params.page) || 1} />
      </Suspense>
    </div>
  )
}
