"use client"

import { useState, useEffect, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Download, Pencil, Trash2, X, Check, ChevronDown, FileText, ExternalLink } from "lucide-react"
import { toast } from "sonner"

import { DocumentStatusBadge } from "./document-status-badge"
import { OcrExtractionReview } from "./ocr-extraction-review"
import {
  updateDocumentStatusAction,
  updateDocumentMetadataAction,
  addDocumentCommentAction,
  deleteDocumentAction,
} from "@/lib/actions/documents"
import { getDocumentDownloadUrl } from "@/hooks/use-documents"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { CategorySuggestions } from "@/components/shared/category-suggestions"
import type { DocumentDetail, DocumentComment, AuditLogEntry } from "@/lib/data/documents"
import type { DocumentStatus, OcrExtractedFields } from "@vexera/types"

// ─── Allowed status transitions ──────────────────────────────────────────────

const ALLOWED_TRANSITIONS: Record<string, DocumentStatus[]> = {
  new: ["auto_processed", "awaiting_review"],
  auto_processed: ["awaiting_review"],
  awaiting_review: ["approved", "awaiting_client"],
  approved: ["archived"],
  awaiting_client: ["awaiting_review", "archived"],
  archived: [],
}

const STATUS_LABELS: Record<DocumentStatus, string> = {
  new: "New",
  auto_processed: "Auto-processed",
  awaiting_review: "Awaiting review",
  approved: "Approved",
  awaiting_client: "Awaiting client",
  archived: "Archived",
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

function formatBytes(bytes: number | null): string {
  if (!bytes) return "—"
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function formatDate(str: string | null): string {
  if (!str) return "—"
  return new Date(str).toLocaleDateString("sk-SK")
}

function formatDateTime(str: string | null): string {
  if (!str) return "—"
  return new Date(str).toLocaleString("sk-SK")
}

function formatEur(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—"
  return new Intl.NumberFormat("sk-SK", { style: "currency", currency: "EUR" }).format(n)
}

// ─── MetadataField — label/value pair ────────────────────────────────────────

function MetadataField({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{label}</span>
      <span className="text-sm font-medium">{value || "—"}</span>
    </div>
  )
}

// ─── MetadataEditForm ─────────────────────────────────────────────────────────

type MetadataFormValues = {
  supplier_name: string
  document_number: string
  issue_date: string
  due_date: string
  total_amount: string
  vat_amount: string
  vat_rate: string
  category: string
}

function MetadataEditForm({
  document,
  onCancel,
  onSaved,
}: {
  document: DocumentDetail
  onCancel: () => void
  onSaved: () => void
}) {
  const [isPending, startTransition] = useTransition()
  const [values, setValues] = useState<MetadataFormValues>({
    supplier_name: document.supplier_name ?? "",
    document_number: document.document_number ?? "",
    issue_date: document.issue_date ?? "",
    due_date: document.due_date ?? "",
    total_amount: document.total_amount != null ? String(document.total_amount) : "",
    vat_amount: document.vat_amount != null ? String(document.vat_amount) : "",
    vat_rate: document.vat_rate != null ? String(document.vat_rate) : "",
    category: document.category ?? "",
  })

  function handleChange(field: keyof MetadataFormValues, val: string) {
    setValues((prev) => ({ ...prev, [field]: val }))
  }

  function handleSave() {
    startTransition(async () => {
      const payload = {
        supplier_name: values.supplier_name || null,
        document_number: values.document_number || null,
        issue_date: values.issue_date || null,
        due_date: values.due_date || null,
        total_amount: values.total_amount ? parseFloat(values.total_amount) : null,
        vat_amount: values.vat_amount ? parseFloat(values.vat_amount) : null,
        vat_rate: values.vat_rate ? parseFloat(values.vat_rate) : null,
        category: values.category || null,
      }

      const result = await updateDocumentMetadataAction(document.id, payload)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Metadata updated")
        onSaved()
      }
    })
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2 flex flex-col gap-1">
          <Label htmlFor="supplier_name" className="text-xs">Supplier name</Label>
          <Input
            id="supplier_name"
            value={values.supplier_name}
            onChange={(e) => handleChange("supplier_name", e.target.value)}
            placeholder="Supplier name"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="document_number" className="text-xs">Document number</Label>
          <Input
            id="document_number"
            value={values.document_number}
            onChange={(e) => handleChange("document_number", e.target.value)}
            placeholder="INV-001"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="category" className="text-xs">Category</Label>
          <Input
            id="category"
            value={values.category}
            onChange={(e) => handleChange("category", e.target.value)}
            placeholder="Category"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="issue_date" className="text-xs">Issue date</Label>
          <Input
            id="issue_date"
            type="date"
            value={values.issue_date}
            onChange={(e) => handleChange("issue_date", e.target.value)}
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="due_date" className="text-xs">Due date</Label>
          <Input
            id="due_date"
            type="date"
            value={values.due_date}
            onChange={(e) => handleChange("due_date", e.target.value)}
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="total_amount" className="text-xs">Total amount (EUR)</Label>
          <Input
            id="total_amount"
            type="number"
            step="0.01"
            value={values.total_amount}
            onChange={(e) => handleChange("total_amount", e.target.value)}
            placeholder="0.00"
            disabled={isPending}
          />
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="vat_amount" className="text-xs">VAT amount (EUR)</Label>
          <Input
            id="vat_amount"
            type="number"
            step="0.01"
            value={values.vat_amount}
            onChange={(e) => handleChange("vat_amount", e.target.value)}
            placeholder="0.00"
            disabled={isPending}
          />
        </div>
        <div className="col-span-2 flex flex-col gap-1">
          <Label htmlFor="vat_rate" className="text-xs">VAT rate (%)</Label>
          <Input
            id="vat_rate"
            type="number"
            step="0.01"
            value={values.vat_rate}
            onChange={(e) => handleChange("vat_rate", e.target.value)}
            placeholder="20"
            disabled={isPending}
          />
        </div>
      </div>
      <div className="flex gap-2">
        <Button size="sm" onClick={handleSave} disabled={isPending}>
          <Check className="h-4 w-4" />
          {isPending ? "Saving…" : "Save"}
        </Button>
        <Button size="sm" variant="outline" onClick={onCancel} disabled={isPending}>
          <X className="h-4 w-4" />
          Cancel
        </Button>
      </div>
    </div>
  )
}

// ─── FilePreview ──────────────────────────────────────────────────────────────

function FilePreview({
  filePath,
  mimeType,
  fileName,
}: {
  filePath: string
  mimeType: string | null
  fileName: string
}) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setIsLoading(true)
    setError(null)

    getDocumentDownloadUrl(filePath)
      .then((url) => {
        if (!cancelled) {
          setPreviewUrl(url)
          setIsLoading(false)
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load preview")
          setIsLoading(false)
        }
      })

    return () => {
      cancelled = true
    }
  }, [filePath])

  if (isLoading) {
    return (
      <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border bg-muted">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">Loading preview…</span>
        </div>
      </div>
    )
  }

  if (error || !previewUrl) {
    return (
      <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border bg-muted">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <FileText className="h-12 w-12 opacity-30" />
          <span className="text-sm">{error ?? "Preview unavailable"}</span>
        </div>
      </div>
    )
  }

  if (mimeType?.startsWith("image/")) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={previewUrl}
        alt={fileName}
        className="w-full rounded-lg border object-contain"
      />
    )
  }

  if (mimeType === "application/pdf") {
    return (
      <div className="flex flex-col gap-2">
        <iframe
          src={previewUrl}
          title={fileName}
          className="aspect-[3/4] w-full rounded-lg border"
        />
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ExternalLink className="h-3 w-3" />
          Open PDF in new tab
        </a>
      </div>
    )
  }

  // Other file types — show download link
  return (
    <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border bg-muted">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <FileText className="h-12 w-12 opacity-30" />
        <span className="text-sm text-center px-4">
          Preview not available for this file type.
        </span>
        <a href={previewUrl} download={fileName}>
          <Button variant="outline" size="sm">
            <Download className="h-4 w-4" />
            Download file
          </Button>
        </a>
      </div>
    </div>
  )
}

// ─── CommentsTab ──────────────────────────────────────────────────────────────

function CommentsTab({
  documentId,
  initialComments,
}: {
  documentId: string
  initialComments: DocumentComment[]
}) {
  const [comments, setComments] = useState<DocumentComment[]>(initialComments)
  const [newComment, setNewComment] = useState("")
  const [isPending, startTransition] = useTransition()

  function handleSubmit() {
    const trimmed = newComment.trim()
    if (!trimmed) return

    startTransition(async () => {
      const result = await addDocumentCommentAction(documentId, trimmed)
      if (result.error) {
        toast.error(result.error)
      } else {
        // Optimistically append comment
        const optimistic: DocumentComment = {
          id: `temp-${Date.now()}`,
          document_id: documentId,
          user_id: null,
          content: trimmed,
          created_at: new Date().toISOString(),
        }
        setComments((prev) => [...prev, optimistic])
        setNewComment("")
        toast.success("Comment added")
      }
    })
  }

  return (
    <div className="flex flex-col gap-4 pt-4">
      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-8">
          No comments yet. Be the first to add one.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {comments.map((comment) => (
            <div key={comment.id} className="rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-muted-foreground">
                  {comment.user_id ? `User ${comment.user_id.slice(0, 8)}…` : "System"}
                </span>
                <span className="text-xs text-muted-foreground">
                  {formatDateTime(comment.created_at)}
                </span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{comment.content}</p>
            </div>
          ))}
        </div>
      )}
      <Separator />
      <div className="flex flex-col gap-2">
        <Label htmlFor="new-comment" className="text-sm font-medium">Add comment</Label>
        <Textarea
          id="new-comment"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Write a comment…"
          rows={3}
          disabled={isPending}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
              e.preventDefault()
              handleSubmit()
            }
          }}
        />
        <div className="flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Ctrl+Enter to submit</span>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={isPending || !newComment.trim()}
          >
            {isPending ? "Posting…" : "Post comment"}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── AuditLogTab ─────────────────────────────────────────────────────────────

function AuditLogTab({ entries }: { entries: AuditLogEntry[] }) {
  if (entries.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8 pt-4">
        No audit log entries found.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-3 pt-4">
      {entries.map((entry) => (
        <div key={entry.id} className="rounded-lg border p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium font-mono">{entry.action}</span>
            <span className="text-xs text-muted-foreground">
              {formatDateTime(entry.created_at)}
            </span>
          </div>
          {entry.user_id && (
            <span className="text-xs text-muted-foreground block mb-2">
              by {entry.user_id.slice(0, 8)}…
            </span>
          )}
          {(entry.old_data || entry.new_data) && (
            <div className="mt-2 rounded-md bg-muted p-2 font-mono text-xs space-y-1">
              {entry.old_data && Object.keys(entry.old_data).length > 0 && (
                <div className="text-red-600">
                  {Object.entries(entry.old_data).map(([k, v]) => (
                    <div key={k}>- {k}: {JSON.stringify(v)}</div>
                  ))}
                </div>
              )}
              {entry.new_data && Object.keys(entry.new_data).length > 0 && (
                <div className="text-green-600">
                  {Object.entries(entry.new_data).map(([k, v]) => (
                    <div key={k}>+ {k}: {JSON.stringify(v)}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

// ─── OcrDataTab ───────────────────────────────────────────────────────────────

function OcrDataTab({ ocrData }: { ocrData: Record<string, unknown> | null }) {
  if (!ocrData) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8 pt-4">
        No OCR data available for this document.
      </p>
    )
  }

  return (
    <div className="pt-4">
      <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap break-words">
        {JSON.stringify(ocrData, null, 2)}
      </pre>
    </div>
  )
}

// ─── DocumentDetailClient — main component ────────────────────────────────────

type Props = {
  document: DocumentDetail
  comments: DocumentComment[]
  auditLogs: AuditLogEntry[]
}

export function DocumentDetailClient({ document, comments, auditLogs }: Props) {
  const router = useRouter()
  const [currentStatus, setCurrentStatus] = useState<DocumentStatus>(document.status)
  const [isEditingMetadata, setIsEditingMetadata] = useState(false)
  const [isStatusPending, startStatusTransition] = useTransition()
  const [isDeletePending, startDeleteTransition] = useTransition()
  const [showRawJson, setShowRawJson] = useState(false)

  const allowedNextStatuses = ALLOWED_TRANSITIONS[currentStatus] ?? []

  function handleStatusChange(newStatus: DocumentStatus) {
    const previousStatus = currentStatus
    startStatusTransition(async () => {
      // Optimistic update
      setCurrentStatus(newStatus)
      const result = await updateDocumentStatusAction(document.id, newStatus)
      if (result.error) {
        // Revert on error
        setCurrentStatus(previousStatus)
        toast.error(result.error)
      } else {
        toast.success(`Status changed to "${STATUS_LABELS[newStatus]}"`)
      }
    })
  }

  function handleDelete() {
    startDeleteTransition(async () => {
      const result = await deleteDocumentAction(document.id)
      if (result.error) {
        toast.error(result.error)
      } else {
        toast.success("Document deleted")
        router.push("/documents")
      }
    })
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Header row */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/documents">
            <ArrowLeft className="h-4 w-4" />
            <span className="sr-only">Back to documents</span>
          </Link>
        </Button>
        <h1 className="text-xl font-semibold truncate flex-1">{document.name}</h1>
      </div>

      {/* Two-column grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* ─── Left column ───────────────────────────────── */}
        <div className="flex flex-col gap-4">
          {/* Status row */}
          <div className="flex flex-wrap items-center gap-3">
            <DocumentStatusBadge status={currentStatus} />

            {allowedNextStatuses.length > 0 && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={isStatusPending}
                    className="gap-1"
                  >
                    {isStatusPending ? "Changing…" : "Change status"}
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {allowedNextStatuses.map((status) => (
                    <DropdownMenuItem
                      key={status}
                      onClick={() => handleStatusChange(status)}
                    >
                      {STATUS_LABELS[status]}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          {/* File info card */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">File info</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <MetadataField label="Type" value={document.document_type ?? "—"} />
              <MetadataField label="MIME type" value={document.mime_type ?? "—"} />
              <MetadataField label="Size" value={formatBytes(document.file_size_bytes)} />
              <MetadataField label="Uploaded" value={formatDateTime(document.created_at)} />
              {document.ocr_status && (
                <MetadataField label="OCR status" value={document.ocr_status} />
              )}
            </CardContent>
          </Card>

          {/* OCR Extraction Review — shown when OCR is complete */}
          {document.ocr_status === "done" && document.ocr_data ? (
            <OcrExtractionReview
              documentId={document.id}
              ocrData={document.ocr_data as unknown as OcrExtractedFields}
              onInvoiceCreated={(invoiceId) => {
                toast.success("Invoice created — redirecting...")
                router.push(`/invoices/${invoiceId}`)
              }}
            />
          ) : (
            /* Extracted fields card — shown when OCR is not done */
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm font-semibold">Extracted fields</CardTitle>
                  {!isEditingMetadata && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsEditingMetadata(true)}
                      className="h-7 gap-1 text-xs"
                    >
                      <Pencil className="h-3 w-3" />
                      Edit
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isEditingMetadata ? (
                  <MetadataEditForm
                    document={document}
                    onCancel={() => setIsEditingMetadata(false)}
                    onSaved={() => setIsEditingMetadata(false)}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-3">
                    <MetadataField label="Supplier" value={document.supplier_name ?? "—"} />
                    <MetadataField label="Doc number" value={document.document_number ?? "—"} />
                    <MetadataField label="Issue date" value={formatDate(document.issue_date)} />
                    <MetadataField label="Due date" value={formatDate(document.due_date)} />
                    <MetadataField label="Total" value={formatEur(document.total_amount)} />
                    <MetadataField label="VAT amount" value={formatEur(document.vat_amount)} />
                    <MetadataField
                      label="VAT rate"
                      value={document.vat_rate != null ? `${document.vat_rate}%` : "—"}
                    />
                    <MetadataField label="Category" value={document.category ?? "—"} />
                    {!document.category && document.ocr_status === "done" && (
                      <div className="col-span-2">
                        <CategorySuggestions
                          documentId={document.id}
                          supplierName={document.supplier_name}
                          totalAmount={document.total_amount}
                          description={document.name}
                          onAccepted={() => router.refresh()}
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Danger zone */}
          <Separator />
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  disabled={isDeletePending}
                >
                  <Trash2 className="h-4 w-4" />
                  {isDeletePending ? "Deleting…" : "Delete document"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete document?</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete <strong>{document.name}</strong>. This action
                    cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className={cn(
                      "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    )}
                  >
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* ─── Right column — file preview (sticky) ──────── */}
        <div className="flex flex-col gap-3 lg:sticky lg:top-6 lg:self-start">
          <FilePreview
            filePath={document.file_path}
            mimeType={document.mime_type}
            fileName={document.name}
          />

          {/* Download button — always visible */}
          <DownloadButton filePath={document.file_path} fileName={document.name} />
        </div>
      </div>

      {/* ─── Tabs ────────────────────────────────────────── */}
      <Tabs defaultValue="comments">
        <TabsList>
          <TabsTrigger value="comments">Comments</TabsTrigger>
          <TabsTrigger value="audit">Audit log</TabsTrigger>
          <TabsTrigger value="ocr" disabled={!document.ocr_data}>
            OCR data
          </TabsTrigger>
        </TabsList>

        <TabsContent value="comments">
          <CommentsTab documentId={document.id} initialComments={comments} />
        </TabsContent>

        <TabsContent value="audit">
          <AuditLogTab entries={auditLogs} />
        </TabsContent>

        <TabsContent value="ocr">
          <div className="flex flex-col gap-3 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">
                {document.ocr_status === "done" ? "OCR extraction complete" : "OCR data"}
              </span>
              {document.ocr_data && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowRawJson((prev) => !prev)}
                >
                  {showRawJson ? "Hide Raw JSON" : "Show Raw JSON"}
                </Button>
              )}
            </div>
            {showRawJson && document.ocr_data && (
              <pre className="rounded-lg bg-muted p-4 text-xs font-mono overflow-auto max-h-96 whitespace-pre-wrap break-words">
                {JSON.stringify(document.ocr_data, null, 2)}
              </pre>
            )}
            {!document.ocr_data && (
              <p className="text-sm text-muted-foreground text-center py-8">
                No OCR data available for this document.
              </p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

// ─── DownloadButton — fetches presigned URL on click ─────────────────────────

function DownloadButton({ filePath, fileName }: { filePath: string; fileName: string }) {
  const [isLoading, setIsLoading] = useState(false)

  async function handleDownload() {
    setIsLoading(true)
    try {
      const url = await getDocumentDownloadUrl(filePath)
      const a = window.document.createElement("a")
      a.href = url
      a.download = fileName
      a.click()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to download file")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Button
      variant="outline"
      className="w-full"
      onClick={handleDownload}
      disabled={isLoading}
    >
      <Download className="h-4 w-4" />
      {isLoading ? "Preparing download…" : "Download file"}
    </Button>
  )
}
