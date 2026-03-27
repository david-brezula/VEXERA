import { Suspense } from "react"
import Link from "next/link"
import { PlusIcon } from "lucide-react"

import { getInvoices, type InvoiceFilters } from "@/features/invoices/data"
import { ImportEInvoiceDialog } from "@/features/invoices/components/import-einvoice-dialog"
import { getActiveOrgId } from "@/features/settings/data-org"
import { InvoiceFilters as InvoiceFiltersBar } from "@/features/invoices/components/invoice-filters"
import { InvoiceTableClient } from "@/features/invoices/components/invoice-table-client"
import { PaginationControls } from "@/shared/components/ui/pagination-controls"
import { Button } from "@/shared/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table"
import { Skeleton } from "@/shared/components/ui/skeleton"
import type { InvoiceStatus, InvoiceType } from "@vexera/types"

// ─── Table skeleton ───────────────────────────────────────────────────────────

const COLUMN_WIDTHS = ["w-24", "w-20", "w-40", "w-24", "w-24", "w-24", "w-20"]

function InvoiceTableSkeleton() {
  return (
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
  )
}

// ─── Async invoice list ───────────────────────────────────────────────────────

async function InvoiceList({ filters, page }: { filters: InvoiceFilters; page: number }) {
  const result = await getInvoices(filters, { page })
  return (
    <>
      <InvoiceTableClient invoices={result.data} />
      <PaginationControls page={result.page} totalPages={result.totalPages} total={result.total} />
    </>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const [params, orgId] = await Promise.all([searchParams, getActiveOrgId()])

  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <p className="text-muted-foreground">Vyberte organizáciu pre zobrazenie faktúr</p>
      </div>
    )
  }

  const filters: InvoiceFilters = {
    status: (params.status as InvoiceStatus | "all") ?? "all",
    invoice_type: (params.type as InvoiceType | "all") ?? "all",
    search: params.q as string | undefined,
    date_from: params.from as string | undefined,
    date_to: params.to as string | undefined,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Faktúry</h1>
        </div>
        <div className="flex items-center gap-2">
          <ImportEInvoiceDialog />
          <Button asChild>
            <Link href="/invoices/new">
              <PlusIcon className="size-4" />
              Nová faktúra
            </Link>
          </Button>
        </div>
      </div>

      <InvoiceFiltersBar />

      <Suspense fallback={<InvoiceTableSkeleton />}>
        <InvoiceList filters={filters} page={Number(params.page) || 1} />
      </Suspense>
    </div>
  )
}
