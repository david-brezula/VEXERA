"use client"

import { useRouter } from "next/navigation"
import { format } from "date-fns"
import Link from "next/link"
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
} from "@tanstack/react-table"
import { FileTextIcon } from "lucide-react"

import { InvoiceStatusBadge } from "@/components/invoices/invoice-status-badge"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { formatEur } from "@vexera/utils"
import type { InvoiceRow } from "@/lib/data/invoices"

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

export function InvoiceTableClient({ invoices }: { invoices: InvoiceRow[] }) {
  const router = useRouter()

  const table = useReactTable({
    data: invoices,
    columns,
    getCoreRowModel: getCoreRowModel(),
  })

  return (
    <div className="rounded-md border bg-card backdrop-blur-xl">
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
          {table.getRowModel().rows.length === 0 ? (
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
  )
}
