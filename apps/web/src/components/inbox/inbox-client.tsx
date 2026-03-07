"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { InboxIcon, Eye, MoreHorizontal, CheckCheck, X, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { DocumentStatusBadge } from "@/components/documents/document-status-badge"
import { batchApproveDocumentsAction, updateDocumentStatusAction } from "@/lib/actions/documents"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"
import type { InboxDocument, InboxStats } from "@/lib/data/inbox"

// ─── Format helpers ───────────────────────────────────────────────────────────

function formatEur(n: number | null) {
  if (!n) return "—"
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(n)
}

function relativeTime(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

// ─── OCR status badge ─────────────────────────────────────────────────────────

function OcrStatusBadge({ status }: { status: string | null }) {
  if (status === "done") {
    return (
      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 font-medium">
        Done
      </Badge>
    )
  }
  if (status === "processing") {
    return (
      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200 font-medium">
        <Loader2 className="h-3 w-3 mr-1 animate-spin" />
        Processing
      </Badge>
    )
  }
  if (status === "failed") {
    return (
      <Badge variant="outline" className="bg-red-100 text-red-700 border-red-200 font-medium">
        Failed
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="bg-gray-100 text-gray-500 border-gray-200 font-medium">
      Pending
    </Badge>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, accent }: { label: string; value: number; accent?: string }) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className={cn("text-3xl font-bold", accent)}>{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{label}</p>
      </CardContent>
    </Card>
  )
}

// ─── Tab filter type ──────────────────────────────────────────────────────────

type TabFilter = "all" | "new" | "auto_processed" | "awaiting_review"

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  documents: InboxDocument[]
  stats: InboxStats
}

export function InboxClient({ documents, stats }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState<TabFilter>("all")
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // ── Filtering ──────────────────────────────────────────────────────────────

  const filtered = tab === "all" ? documents : documents.filter(d => d.status === tab)

  // ── Selection helpers ──────────────────────────────────────────────────────

  const allFilteredSelected =
    filtered.length > 0 && filtered.every(d => selectedIds.has(d.id))

  function toggleSelectAll() {
    if (allFilteredSelected) {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filtered.forEach(d => next.delete(d.id))
        return next
      })
    } else {
      setSelectedIds(prev => {
        const next = new Set(prev)
        filtered.forEach(d => next.add(d.id))
        return next
      })
    }
  }

  function toggleRow(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function clearSelection() {
    setSelectedIds(new Set())
  }

  // ── Batch approve ──────────────────────────────────────────────────────────

  function handleBatchApprove() {
    const ids = Array.from(selectedIds)
    startTransition(async () => {
      const result = await batchApproveDocumentsAction(ids)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success(`Approved ${result.approvedCount ?? ids.length} document${(result.approvedCount ?? ids.length) !== 1 ? "s" : ""}`)
        clearSelection()
        router.refresh()
      }
    })
  }

  // ── Quick approve single ───────────────────────────────────────────────────

  function handleQuickApprove(id: string) {
    startTransition(async () => {
      const result = await updateDocumentStatusAction(id, "approved")
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Document approved")
        router.refresh()
      }
    })
  }

  // ── Tab change — clear selection ───────────────────────────────────────────

  function handleTabChange(value: string) {
    setTab(value as TabFilter)
    clearSelection()
  }

  const selectedCount = selectedIds.size

  return (
    <div className="space-y-6">
      {/* Stats bar */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <StatCard label="New" value={stats.newCount} />
        <StatCard label="Auto-processed" value={stats.autoProcessedCount} accent="text-blue-600" />
        <StatCard label="Awaiting Review" value={stats.awaitingReviewCount} accent="text-yellow-600" />
        <StatCard label="Approved Today" value={stats.approvedTodayCount} accent="text-green-600" />
      </div>

      {/* Filter tabs */}
      <Tabs value={tab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">
            All
            <Badge variant="secondary" className="ml-2 text-xs">
              {documents.length}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="new">
            New
            <Badge variant="secondary" className="ml-2 text-xs">
              {stats.newCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="auto_processed">
            Auto-processed
            <Badge variant="secondary" className="ml-2 text-xs">
              {stats.autoProcessedCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="awaiting_review">
            Awaiting Review
            <Badge variant="secondary" className="ml-2 text-xs">
              {stats.awaitingReviewCount}
            </Badge>
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Batch actions bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 px-4 py-2">
          <span className="text-sm font-medium">
            {selectedCount} selected
          </span>
          <Button
            size="sm"
            onClick={handleBatchApprove}
            disabled={isPending}
            className="gap-1.5"
          >
            {isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <CheckCheck className="h-4 w-4" />
            )}
            Approve Selected ({selectedCount})
          </Button>
          <button
            onClick={clearSelection}
            className="text-sm text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <X className="h-3 w-3" />
            Clear selection
          </button>
        </div>
      )}

      {/* Table or empty state */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-20 text-center">
          <InboxIcon className="size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">Nothing to review</h3>
          <p className="text-sm text-muted-foreground mt-1">All documents have been processed.</p>
        </div>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox
                    checked={allFilteredSelected}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Select all"
                  />
                </TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>OCR</TableHead>
                <TableHead>Age</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(doc => {
                const isSelected = selectedIds.has(doc.id)
                const canApprove =
                  doc.status === "awaiting_review" || doc.status === "auto_processed"

                return (
                  <TableRow
                    key={doc.id}
                    className={cn(isSelected && "bg-primary/5")}
                  >
                    {/* Checkbox */}
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(doc.id)}
                        aria-label={`Select ${doc.name}`}
                      />
                    </TableCell>

                    {/* Name */}
                    <TableCell className="max-w-[200px]">
                      <Link
                        href={`/documents/${doc.id}`}
                        className="font-medium hover:underline truncate block"
                        title={doc.name}
                      >
                        {doc.name}
                      </Link>
                      {doc.document_number && (
                        <span className="text-xs text-muted-foreground">{doc.document_number}</span>
                      )}
                    </TableCell>

                    {/* Type */}
                    <TableCell>
                      {doc.document_type ? (
                        <Badge variant="secondary" className="text-xs capitalize">
                          {doc.document_type.replace(/_/g, " ")}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>

                    {/* Supplier */}
                    <TableCell className="text-sm">
                      {doc.supplier_name ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>

                    {/* Amount */}
                    <TableCell className="text-right font-medium tabular-nums">
                      {formatEur(doc.total_amount)}
                    </TableCell>

                    {/* Status */}
                    <TableCell>
                      <DocumentStatusBadge status={doc.status} />
                    </TableCell>

                    {/* OCR */}
                    <TableCell>
                      <OcrStatusBadge status={doc.ocr_status} />
                    </TableCell>

                    {/* Age */}
                    <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                      {relativeTime(doc.created_at)}
                    </TableCell>

                    {/* Actions dropdown */}
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            aria-label="Document actions"
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem asChild>
                            <Link href={`/documents/${doc.id}`} className="flex items-center gap-2">
                              <Eye className="h-4 w-4" />
                              View
                            </Link>
                          </DropdownMenuItem>
                          {canApprove && (
                            <DropdownMenuItem
                              onClick={() => handleQuickApprove(doc.id)}
                              disabled={isPending}
                              className="flex items-center gap-2"
                            >
                              <CheckCheck className="h-4 w-4" />
                              Approve
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem asChild>
                            <Link
                              href={`/documents/${doc.id}?action=send`}
                              className="flex items-center gap-2"
                            >
                              <InboxIcon className="h-4 w-4" />
                              Send to client
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
