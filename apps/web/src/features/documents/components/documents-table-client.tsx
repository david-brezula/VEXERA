"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  type ColumnDef,
  type RowSelectionState,
} from "@tanstack/react-table"
import {
  UploadCloudIcon,
  FolderOpenIcon,
  SearchIcon,
  CheckCircle2Icon,
  Loader2Icon,
} from "lucide-react"

import { DocumentStatusBadge } from "./document-status-badge"
import { DocumentUploader } from "./document-uploader"
import { DOCUMENT_TYPE_LABELS } from "@/features/documents/schemas"
import { batchApproveDocumentsAction } from "../actions"
import { Button } from "@/shared/components/ui/button"
import { Input } from "@/shared/components/ui/input"
import { Checkbox } from "@/shared/components/ui/checkbox"
import { Badge } from "@/shared/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/shared/components/ui/dialog"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/shared/components/ui/table"
import { Skeleton } from "@/shared/components/ui/skeleton"
import type { DocumentRow } from "../data"
import type { DocumentStatus } from "@vexera/types"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatAmount(amount: number | null): string {
  if (amount == null) return "—"
  return new Intl.NumberFormat("sk-SK", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(amount)
}

// ─── Status filter options ───────────────────────────────────────────────────

const STATUS_OPTIONS: { value: DocumentStatus | "all"; label: string }[] = [
  { value: "all", label: "Všetky stavy" },
  { value: "new", label: "Nový" },
  { value: "auto_processed", label: "Automaticky spracovaný" },
  { value: "awaiting_review", label: "Čaká na kontrolu" },
  { value: "approved", label: "Schválený" },
  { value: "awaiting_client", label: "Čaká na klienta" },
  { value: "archived", label: "Archivovaný" },
]

// ─── Columns ─────────────────────────────────────────────────────────────────

const columns: ColumnDef<DocumentRow>[] = [
  {
    id: "select",
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && "indeterminate")
        }
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Vybrať všetky"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Vybrať riadok"
        onClick={(e) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: "document_type",
    header: "Typ",
    cell: ({ row }) => {
      const type = row.original.document_type
      const label = type ? DOCUMENT_TYPE_LABELS[type] ?? type : "Document"
      return (
        <Badge variant="secondary" className="text-xs whitespace-nowrap">
          {label}
        </Badge>
      )
    },
  },
  {
    id: "supplier",
    header: "Dodávateľ / Partner",
    cell: ({ row }) => (
      <div className="min-w-0">
        <p className="font-medium text-sm truncate">
          {row.original.supplier_name ?? row.original.name}
        </p>
        {row.original.document_number && (
          <p className="text-xs text-muted-foreground font-mono">
            {row.original.document_number}
          </p>
        )}
      </div>
    ),
  },
  {
    accessorKey: "created_at",
    header: "Dátum",
    cell: ({ row }) => (
      <span className="text-sm whitespace-nowrap">
        {format(new Date(row.original.created_at), "dd.MM.yyyy")}
      </span>
    ),
  },
  {
    accessorKey: "total_amount",
    header: () => <span className="block text-right">Suma</span>,
    cell: ({ row }) => (
      <span className="block text-right tabular-nums font-medium text-sm">
        {formatAmount(row.original.total_amount)}
      </span>
    ),
  },
  {
    accessorKey: "status",
    header: "Stav",
    cell: ({ row }) => (
      <DocumentStatusBadge status={row.original.status} />
    ),
  },
]

// ─── Main component ──────────────────────────────────────────────────────────

type Props = {
  documents: DocumentRow[]
  hasFilters: boolean
}

export function DocumentsTableClient({ documents, hasFilters }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [uploadOpen, setUploadOpen] = useState(false)
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [isBatchApproving, setIsBatchApproving] = useState(false)

  const table = useReactTable({
    data: documents,
    columns,
    getCoreRowModel: getCoreRowModel(),
    onRowSelectionChange: setRowSelection,
    state: { rowSelection },
    getRowId: (row) => row.id,
  })

  const selectedIds = Object.keys(rowSelection).filter((id) => rowSelection[id])
  const hasSelection = selectedIds.length > 0

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

  function handleRefresh() {
    router.refresh()
    setUploadOpen(false)
  }

  async function handleBatchApprove() {
    if (selectedIds.length === 0) return
    setIsBatchApproving(true)
    const result = await batchApproveDocumentsAction(selectedIds)
    setIsBatchApproving(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success(`Schválených ${result.approvedCount} dokladov`)
      setRowSelection({})
      router.refresh()
    }
  }

  return (
    <div className="space-y-4">
      {/* Actions bar */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative w-64">
            <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
            <Input
              placeholder="Hľadať doklady..."
              defaultValue={searchParams.get("q") ?? ""}
              onChange={(e) => setParam("q", e.target.value)}
              className="pl-8"
            />
          </div>

          {/* Status filter */}
          <Select
            value={searchParams.get("status") ?? "all"}
            onValueChange={(v) => setParam("status", v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Všetky stavy" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Type filter */}
          <Select
            value={searchParams.get("type") ?? "all"}
            onValueChange={(v) => setParam("type", v)}
          >
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Všetky typy" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Všetky typy</SelectItem>
              {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-2">
          {/* Batch approve */}
          {hasSelection && (
            <Button
              variant="outline"
              onClick={handleBatchApprove}
              disabled={isBatchApproving}
            >
              {isBatchApproving ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <CheckCircle2Icon className="size-4" />
              )}
              Schváliť vybrané ({selectedIds.length})
            </Button>
          )}

          {/* Upload button */}
          <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
            <DialogTrigger asChild>
              <Button>
                <UploadCloudIcon className="size-4" />
                Nahrať
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Nahrať doklad</DialogTitle>
              </DialogHeader>
              <DocumentUploader onSuccess={handleRefresh} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Table */}
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-16 text-center">
          <FolderOpenIcon className="size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Žiadne doklady</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {hasFilters
              ? "Skúste upraviť filtre."
              : "Nahrajte prvý účtovný doklad."}
          </p>
          {!hasFilters && (
            <Button onClick={() => setUploadOpen(true)}>
              <UploadCloudIcon className="size-4" />
              Nahrať doklad
            </Button>
          )}
        </div>
      ) : (
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
              {table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  data-state={row.getIsSelected() && "selected"}
                  onClick={() => router.push(`/documents/${row.original.id}`)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
