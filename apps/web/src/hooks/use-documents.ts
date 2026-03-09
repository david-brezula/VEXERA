"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { useSupabase } from "@/providers/supabase-provider"
import { useOrganization } from "@/providers/organization-provider"
import { queryKeys } from "@/lib/query-keys"
import type { DocumentUploadFormValues } from "@/lib/validations/document.schema"

// ─── useUploadDocument ────────────────────────────────────────────────────────

export function useUploadDocument() {
  const { supabase, user } = useSupabase()
  const { activeOrg } = useOrganization()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      file,
      metadata,
      onProgress,
    }: {
      file: File
      metadata: DocumentUploadFormValues
      onProgress?: (percent: number) => void
    }) => {
      if (!activeOrg || !user) throw new Error("Not authenticated")

      // 1. Get presigned upload URL from our API route
      const res = await fetch("/api/storage/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: file.name,
          mimeType: file.type,
          organizationId: activeOrg.id,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error ?? "Failed to get upload URL")
      }

      const { uploadUrl, filePath } = (await res.json()) as {
        uploadUrl: string
        filePath: string
      }

      // 2. Upload directly to S3 via presigned PUT URL (with progress)
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open("PUT", uploadUrl)
        xhr.setRequestHeader("Content-Type", file.type)

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100))
          }
        }

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve()
          } else {
            reject(new Error(`S3 upload failed: ${xhr.status}`))
          }
        }

        xhr.onerror = () => reject(new Error("Network error during upload"))
        xhr.send(file)
      })

      // 3. Save document metadata to DB
      const { data: doc, error: docError } = await supabase
        .from("documents")
        .insert({
          organization_id: activeOrg.id,
          invoice_id: metadata.invoice_id || null,
          name: metadata.name,
          document_type: metadata.document_type,
          file_path: filePath,
          file_size_bytes: file.size,
          mime_type: file.type,
          uploaded_by: user.id,
          status: "new",
        })
        .select("id")
        .single()

      if (docError) throw docError

      // 4. Trigger OCR asynchronously (fire-and-forget — don't await)
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
      const { data: { session } } = await supabase.auth.getSession()
      if (supabaseUrl && session?.access_token) {
        fetch(`${supabaseUrl}/functions/v1/process-ocr`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ document_id: doc.id, organization_id: activeOrg.id }),
        }).catch((e) => console.warn("OCR trigger failed (non-fatal):", e))
      }

      // 5. Audit log
      await supabase.from("audit_logs").insert({
        organization_id: activeOrg.id,
        user_id: user.id,
        action: "DOCUMENT_UPLOADED",
        entity_type: "document",
        entity_id: doc.id,
        new_data: {
          name: metadata.name,
          document_type: metadata.document_type,
          file_size_bytes: file.size,
        },
      })

      return doc.id
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.documents.all(activeOrg?.id ?? "") })
      toast.success("Document uploaded")
    },
    onError: (error: Error) => {
      toast.error(error.message)
    },
  })
}

// ─── getDocumentDownloadUrl ───────────────────────────────────────────────────

export async function getDocumentDownloadUrl(filePath: string): Promise<string> {
  const res = await fetch(`/api/storage/download?path=${encodeURIComponent(filePath)}`)
  if (!res.ok) throw new Error("Failed to get download URL")
  const { downloadUrl } = (await res.json()) as { downloadUrl: string }
  return downloadUrl
}
