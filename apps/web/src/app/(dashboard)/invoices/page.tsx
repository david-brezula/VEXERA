"use client"

import { useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import Link from "next/link"
import { format } from "date-fns"
import { PlusIcon, FileTextIcon, SearchIcon } from "lucide-react"
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table"

import { useInvoices, type InvoiceRow, type InvoiceFilters } from "@/hooks/use-invoices"
import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge"
import { useOrganization } from "@/providers/organization-provider"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { formatEur } from "@vexera/utils"
import type { InvoiceStatus, InvoiceType } from "@vexera/types"

// ─── Columns ──────────────────────────────────────────────────────────────────

const columns: ColumnDef<InvoiceRow>[] = [
  {
    accessorKey: "invoice_number",
    header: "Invoice #",
    cell: ({ row }) => (
      <span className="font-mono font-medium">{row.original.invoice_number}</span>
    ),
  },
  {
    accessorKey: "invoice_type",
    header: "Type",
    cell: ({ row }) => (
      <span className="capitalize text-sm text-muted-foreground">
        {row.original.invoice_type}
      </span>
    ),
  },
  {
    id: "counterparty",
    header: "Counterparty",
    cell: ({ row }) => {
      const inv = row.original
      return inv.invoice_type === "issued" ? inv.customer_name : inv.supplier_name
    },
  },
  {
    accessorKey: "issue_date",
    header: "Issue date",
    cell: ({ row }) => format(new Date(row.original.issue_date), "dd.MM.yyyy"),
  },
  {
    accessorKey: "due_date",
    header: "Due date",
    cell: ({ row }) => format(new Date(row.original.due_date), "dd.MM.yyyy"),
  },
  {
    accessorKey: "total",
    header: () => <span className="block text-right">Total</span>,
    cell: ({ row }) => (
      <span className="block text-right tabular-nums font-medium">
        {formatEur(row.original.total)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => <InvoiceStatusBadge status={row.original.status} />,
  },
]

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function InvoicesPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { activeOrg } = useOrganization()

  const filters: InvoiceFilters = {
    status: (searchParams.get("status") ?? "all") as InvoiceStatus | "all",
    invoice_type: (searchParams.get("type") ?? "all") as InvoiceType | "all",
    search: searchParams.get("q") ?? undefined,
    date_from: searchParams.get("from") ?? undefined,
    date_to: searchParams.get("to") ?? undefined,
  }

  const { data: invoices, isLoading } = useInvoices(filters)

  const setParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value && value !== "all") {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )

  const table = useReactTable({
    data: invoices ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  if (!activeOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FileTextIcon className="size-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Select an organization to view invoices</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground">
            Issued and received invoices for {activeOrg.name}
          </p>
        </div>
        <Button asChild>
          <Link href="/invoices/new">
            <PlusIcon className="size-4" />
            New invoice
          </Link>
        </Button>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search invoices…"
            defaultValue={searchParams.get("q") ?? ""}
            onChange={(e) => setParam("q", e.target.value)}
            className="pl-8"
          />
        </div>

        <Select
          value={searchParams.get("status") ?? "all"}
          onValueChange={(v) => setParam("status", v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
            <SelectItem value="overdue">Overdue</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
            <SelectItem value="closed">Closed</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("type") ?? "all"}
          onValueChange={(v) => setParam("type", v)}
        >
          <SelectTrigger className="w-36">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            <SelectItem value="issued">Issued</SelectItem>
            <SelectItem value="received">Received</SelectItem>
          </SelectContent>
        </Select>

        <Input
          type="date"
          className="w-40"
          defaultValue={searchParams.get("from") ?? ""}
          onChange={(e) => setParam("from", e.target.value)}
        />
        <Input
          type="date"
          className="w-40"
          defaultValue={searchParams.get("to") ?? ""}
          onChange={(e) => setParam("to", e.target.value)}
        />
      </div>

      {/* Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((h) => (
                  <TableHead key={h.id}>
                    {h.isPlaceholder
                      ? null
                      : flexRender(h.column.columnDef.header, h.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <TableRow key={i}>
                  {columns.map((_, j) => (
                    <TableCell key={j}>
                      <Skeleton className="h-4 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-40 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <FileTextIcon className="size-10 text-muted-foreground" />
                    <p className="text-muted-foreground">No invoices found</p>
                    <Button asChild size="sm" variant="outline">
                      <Link href="/invoices/new">Create your first invoice</Link>
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => router.push(`/invoices/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
