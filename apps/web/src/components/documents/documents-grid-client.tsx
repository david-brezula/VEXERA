"use client"

import { useState, useCallback } from "react"
import { useRouter, useSearchParams, usePathname } from "next/navigation"
import { format } from "date-fns"
import { toast } from "sonner"
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

import { DocumentUploader } from "@/components/documents/document-uploader"
import { DOCUMENT_TYPE_LABELS } from "@/lib/validations/document.schema"
import { deleteDocumentAction } from "@/lib/actions/documents"
import { getDocumentDownloadUrl } from "@/hooks/use-documents"
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
  DialogClose,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import type { DocumentRow } from "@/lib/data/documents"

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

function DocumentCard({ doc, onDeleted }: { doc: DocumentRow; onDeleted: () => void }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [loadingAction, setLoadingAction] = useState<"preview" | "download" | null>(null)

  const Icon = getFileIcon(doc.mime_type)
  const typeLabel =
    (doc.document_type ? DOCUMENT_TYPE_LABELS[doc.document_type] : null) ??
    doc.document_type ??
    "Document"

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
    const result = await deleteDocumentAction(doc.id)
    setIsDeleting(false)
    if (result.error) {
      toast.error(result.error)
    } else {
      toast.success("Document deleted")
      setDeleteOpen(false)
      onDeleted()
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
            <Button variant="destructive" disabled={isDeleting} onClick={handleDelete}>
              {isDeleting && <Loader2Icon className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Card */}
      <div className="group relative rounded-lg border bg-card p-4 flex flex-col gap-3 backdrop-blur-xl hover:shadow-lg hover:bg-white/80 dark:hover:bg-white/8 transition-all duration-200 cursor-pointer">
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

        <Badge variant="secondary" className="w-fit text-xs">
          {typeLabel}
        </Badge>

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
            {isImage(doc.mime_type) ? "Preview" : "Open"}
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

// ─── Main component ───────────────────────────────────────────────────────────

type Props = {
  documents: DocumentRow[]
  hasFilters: boolean
}

export function DocumentsGridClient({ documents, hasFilters }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [uploadOpen, setUploadOpen] = useState(false)

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

  return (
    <div className="space-y-6">
      {/* Upload dialog trigger (header button) */}
      <div className="flex justify-end">
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
            <DocumentUploader onSuccess={handleRefresh} />
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
      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-16 text-center">
          <FolderOpenIcon className="size-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold">No documents found</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            {hasFilters
              ? "Try adjusting your filters."
              : "Upload your first accounting document to get started."}
          </p>
          {!hasFilters && (
            <Button onClick={() => setUploadOpen(true)}>
              <UploadCloudIcon className="size-4" />
              Upload document
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {documents.map((doc) => (
            <DocumentCard key={doc.id} doc={doc} onDeleted={() => router.refresh()} />
          ))}
        </div>
      )}
    </div>
  )
}
