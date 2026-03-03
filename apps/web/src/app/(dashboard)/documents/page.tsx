import { Suspense } from "react"
import { FolderOpenIcon } from "lucide-react"

import { getDocuments, type DocumentFilters } from "@/lib/data/documents"
import { getActiveOrgId } from "@/lib/data/org"
import { DocumentsGridClient } from "@/components/documents/documents-grid-client"
import { Skeleton } from "@/components/ui/skeleton"

// ─── Async data component ─────────────────────────────────────────────────────

async function DocumentsContent({
  filters,
  hasFilters,
}: {
  filters: DocumentFilters
  hasFilters: boolean
}) {
  const documents = await getDocuments(filters)
  return <DocumentsGridClient documents={documents} hasFilters={hasFilters} />
}

// ─── Grid skeleton ────────────────────────────────────────────────────────────

function DocumentsContentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Skeleton className="h-9 w-36" />
      </div>
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-44" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="rounded-lg border p-4 space-y-3">
            <div className="flex items-start gap-3">
              <Skeleton className="size-10 rounded-md" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            </div>
            <Skeleton className="h-5 w-24" />
            <div className="flex gap-1">
              <Skeleton className="h-8 w-16" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        ))}
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
  }
  const hasFilters = !!(filters.document_type || filters.search)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">
          Upload and manage accounting documents
        </p>
      </div>

      <Suspense fallback={<DocumentsContentSkeleton />}>
        <DocumentsContent filters={filters} hasFilters={hasFilters} />
      </Suspense>
    </div>
  )
}
