"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { format } from "date-fns"
import {
  UploadCloudIcon,
  FolderOpenIcon,
  SearchIcon,
  DownloadIcon,
  Trash2Icon,
  FileTextIcon,
  ImageIcon,
  FileIcon,
  ExternalLinkIcon,
  Loader2Icon,
} from "lucide-react"
import { toast } from "sonner"

import {
  useDocuments,
  useDeleteDocument,
  getDocumentDownloadUrl,
} from "@/hooks/use-documents"
import { DocumentUploader } from "@/components/documents/document-uploader"
import {
  DOCUMENT_TYPE_LABELS,
} from "@/lib/validations/document.schema"
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
  DialogFooter,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return FileIcon
  if (mimeType === "application/pdf") return FileTextIcon
  if (mimeType.startsWith("image/")) return ImageIcon
  return FileIcon
}

function isImage(mimeType: string | null): boolean {
  return !!mimeType?.startsWith("image/")
}

// ─── Document Card ─────────────────────────────────────────────────────────────

type DocumentRow = {
  id: string
  name: string
  document_type: string | null
  file_path: string
  file_size_bytes: number | null
  mime_type: string | null
  invoice_id: string | null
  created_at: string
}

type DocumentCardProps = {
  doc: DocumentRow
}

function DocumentCard({ doc }: DocumentCardProps) {
  const deleteDocument = useDeleteDocument()
  const [isDeleting, setIsDeleting] = useState(false)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [loadingAction, setLoadingAction] = useState<"preview" | "download" | null>(null)

  const Icon = getFileIcon(doc.mime_type)
  const typeLabel = (doc.document_type ? DOCUMENT_TYPE_LABELS[doc.document_type] : null) ?? doc.document_type ?? "Document"

  async function handlePreview() {
    setLoadingAction("preview")
    try {
      const url = await getDocumentDownloadUrl(doc.file_path)
      if (isImage(doc.mime_type)) {
        setPreviewUrl(url)
        setPreviewOpen(true)
      } else {
        window.open(url, "_blank", "noopener,noreferrer")
      }
    } catch {
      toast.error("Could not load preview")
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleDownload() {
    setLoadingAction("download")
    try {
      const url = await getDocumentDownloadUrl(doc.file_path)
      const a = document.createElement("a")
      a.href = url
      a.download = doc.name
      a.click()
    } catch {
      toast.error("Could not download file")
    } finally {
      setLoadingAction(null)
    }
  }

  async function handleDelete() {
    setIsDeleting(true)
    try {
      await deleteDocument.mutateAsync(doc.id)
      setDeleteOpen(false)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <>
      {/* Image preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="truncate">{doc.name}</DialogTitle>
          </DialogHeader>
          {previewUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt={doc.name}
              className="w-full rounded-md object-contain max-h-[70vh]"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation dialog */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete document?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{doc.name}</span> will be
            permanently removed. This cannot be undone.
          </p>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" disabled={isDeleting}>
                Cancel
              </Button>
            </DialogClose>
            <Button
              variant="destructive"
              disabled={isDeleting}
              onClick={handleDelete}
            >
              {isDeleting && <Loader2Icon className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card */}
      <div className="group relative rounded-lg border bg-card p-4 flex flex-col gap-3 hover:shadow-sm transition-shadow">
        {/* File type icon + name */}
        <div className="flex items-start gap-3">
          <div className="shrink-0 size-10 rounded-md bg-muted flex items-center justify-center">
            <Icon className="size-5 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p
              className="font-medium text-sm leading-tight truncate cursor-pointer hover:text-primary"
              title={doc.name}
              onClick={handlePreview}
            >
              {doc.name}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {doc.file_size_bytes ? formatBytes(doc.file_size_bytes) : "—"} ·{" "}
              {format(new Date(doc.created_at), "dd.MM.yyyy")}
            </p>
          </div>
        </div>

        {/* Type badge */}
        <Badge variant="secondary" className="w-fit text-xs">
          {typeLabel}
        </Badge>

        {/* Actions */}
        <div className="flex items-center gap-1 mt-auto">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handlePreview}
            disabled={!!loadingAction}
          >
            {loadingAction === "preview" ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : doc.mime_type === "application/pdf" ? (
              <ExternalLinkIcon className="size-3" />
            ) : (
              <ImageIcon className="size-3" />
            )}
            {doc.mime_type?.startsWith("image/") ? "Preview" : "Open"}
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={handleDownload}
            disabled={!!loadingAction}
          >
            {loadingAction === "download" ? (
              <Loader2Icon className="size-3 animate-spin" />
            ) : (
              <DownloadIcon className="size-3" />
            )}
            Download
          </Button>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs text-destructive hover:text-destructive ml-auto"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2Icon className="size-3" />
            Delete
          </Button>
        </div>
      </div>
    </>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function DocumentsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { activeOrg } = useOrganization()
  const [uploadOpen, setUploadOpen] = useState(false)

  const filters = {
    document_type: searchParams.get("type") ?? undefined,
    search: searchParams.get("q") ?? undefined,
  }

  const { data: documents, isLoading } = useDocuments(
    activeOrg ? filters : undefined
  )

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

  if (!activeOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <FolderOpenIcon className="size-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">
          Select an organization to view documents
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground">
            Upload and manage accounting documents for {activeOrg.name}
          </p>
        </div>

        <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
          <DialogTrigger asChild>
            <Button>
              <UploadCloudIcon className="size-4" />
              Upload document
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>Upload document</DialogTitle>
            </DialogHeader>
            <DocumentUploader onSuccess={() => setUploadOpen(false)} />
          </DialogContent>
        </Dialog>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-3">
        <div className="relative w-64">
          <SearchIcon className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Search documents…"
            defaultValue={searchParams.get("q") ?? ""}
            onChange={(e) => setParam("q", e.target.value)}
            className="pl-8"
          />
        </div>

        <Select
          value={searchParams.get("type") ?? "all"}
          onValueChange={(v) => setParam("type", v)}
        >
          <SelectTrigger className="w-44">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {isLoading ? (
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
      ) : documents?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-16 text-center">
          <FolderOpenIcon className="size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No documents found</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {filters.document_type || filters.search
              ? "Try adjusting your filters."
              : "Upload your first accounting document to get started."}
          </p>
          {!filters.document_type && !filters.search && (
            <Button onClick={() => setUploadOpen(true)}>
              <UploadCloudIcon className="size-4" />
              Upload document
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {documents?.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}
        </div>
      )}
    </div>
  )
}
