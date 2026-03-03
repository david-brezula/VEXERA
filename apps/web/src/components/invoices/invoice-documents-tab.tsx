"use client"

import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { DocumentUploader } from "@/components/documents/document-uploader"
import { Button } from "@/components/ui/button"
import { deleteDocumentAction } from "@/lib/actions/documents"
import { getDocumentDownloadUrl } from "@/hooks/use-documents"
import type { DocumentRow } from "@/lib/data/documents"

type Props = {
  invoiceId: string
  initialDocuments: DocumentRow[]
}

export function InvoiceDocumentsTab({ invoiceId, initialDocuments }: Props) {
  const router = useRouter()

  async function handleDelete(docId: string) {
    const result = await deleteDocumentAction(docId)
    if (result.error) toast.error(result.error)
    else { toast.success("Document deleted"); router.refresh() }
  }

  return (
    <div className="space-y-4">
      <DocumentUploader
        invoiceId={invoiceId}
        onSuccess={() => router.refresh()}
      />
      {initialDocuments.length > 0 && (
        <div className="space-y-2">
          {initialDocuments.map((doc) => (
            <div
              key={doc.id}
              className="flex items-center justify-between rounded-md border px-4 py-3"
            >
              <div>
                <p className="font-medium text-sm">{doc.name}</p>
                <p className="text-xs text-muted-foreground capitalize">
                  {doc.document_type?.replace(/_/g, " ")}
                  {doc.file_size_bytes &&
                    ` · ${(doc.file_size_bytes / 1024).toFixed(0)} KB`}
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    const url = await getDocumentDownloadUrl(doc.file_path)
                    window.open(url, "_blank")
                  }}
                >
                  Download
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(doc.id)}
                >
                  Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
