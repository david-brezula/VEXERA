"use client"

import { useRef, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { UploadCloudIcon, FileIcon, XIcon, Loader2Icon } from "lucide-react"

import {
  documentUploadSchema,
  type DocumentUploadFormValues,
  ACCEPTED_MIME_TYPES,
  MAX_FILE_SIZE_BYTES,
  DOCUMENT_TYPE_LABELS,
} from "@/lib/validations/document.schema"
import { useUploadDocument } from "@/hooks/use-documents"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type Props = {
  /** Pre-link uploaded document to this invoice */
  invoiceId?: string
  onSuccess?: () => void
}

export function DocumentUploader({ invoiceId, onSuccess }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [progress, setProgress] = useState(0)
  const [fileError, setFileError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const uploadDocument = useUploadDocument()

  const form = useForm<DocumentUploadFormValues>({
    resolver: zodResolver(documentUploadSchema),
    defaultValues: {
      name: "",
      document_type: "other",
      invoice_id: invoiceId ?? "",
    },
  })

  function validateFile(f: File): string | null {
    if (!ACCEPTED_MIME_TYPES.includes(f.type)) {
      return `Unsupported file type: ${f.type}. Accepted: PDF, PNG, JPG, XLSX.`
    }
    if (f.size > MAX_FILE_SIZE_BYTES) {
      return `File too large. Maximum size is 20 MB.`
    }
    return null
  }

  function handleFileSelected(f: File) {
    const error = validateFile(f)
    if (error) {
      setFileError(error)
      return
    }
    setFileError(null)
    setFile(f)
    // Pre-fill name from filename (without extension)
    if (!form.getValues("name")) {
      form.setValue("name", f.name.replace(/\.[^.]+$/, ""))
    }
  }

  // Native drag-and-drop handlers
  function onDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function onDragLeave() {
    setIsDragging(false)
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped) handleFileSelected(dropped)
  }

  async function onSubmit(values: DocumentUploadFormValues) {
    if (!file) return
    setProgress(0)

    await uploadDocument.mutateAsync(
      {
        file,
        metadata: values,
        onProgress: setProgress,
      },
      {
        onSuccess: () => {
          form.reset()
          setFile(null)
          setProgress(0)
          onSuccess?.()
        },
      }
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {/* Drop zone */}
        <div
          role="button"
          tabIndex={0}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          onKeyDown={(e) => e.key === "Enter" && inputRef.current?.click()}
          className={cn(
            "flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 cursor-pointer transition-colors",
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border hover:border-primary/50 hover:bg-muted/30"
          )}
        >
          {file ? (
            <div className="flex items-center gap-3">
              <FileIcon className="size-8 text-muted-foreground" />
              <div>
                <p className="font-medium text-sm">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {(file.size / 1024).toFixed(0)} KB
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-7"
                onClick={(e) => {
                  e.stopPropagation()
                  setFile(null)
                  setFileError(null)
                }}
              >
                <XIcon className="size-4" />
              </Button>
            </div>
          ) : (
            <>
              <UploadCloudIcon className="size-10 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">
                Drag a file here or <span className="text-primary underline">browse</span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                PDF, PNG, JPG, XLSX · max 20 MB
              </p>
            </>
          )}
        </div>

        {/* Hidden file input */}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_MIME_TYPES.join(",")}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) handleFileSelected(f)
          }}
        />

        {fileError && (
          <p className="text-sm text-destructive">{fileError}</p>
        )}

        {file && (
          <div className="grid grid-cols-2 gap-4">
            {/* Document name */}
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document name</FormLabel>
                  <FormControl>
                    <Input placeholder="Invoice from supplier" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Document type */}
            <FormField
              control={form.control}
              name="document_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Document type</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {Object.entries(DOCUMENT_TYPE_LABELS).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

        {/* Upload progress */}
        {uploadDocument.isPending && (
          <div className="space-y-1">
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div
                className="h-full bg-primary transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground text-right">{progress}%</p>
          </div>
        )}

        {file && (
          <Button type="submit" disabled={uploadDocument.isPending || !file}>
            {uploadDocument.isPending && <Loader2Icon className="size-4 animate-spin" />}
            Upload document
          </Button>
        )}
      </form>
    </Form>
  )
}
