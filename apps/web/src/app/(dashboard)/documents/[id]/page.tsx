import { notFound } from "next/navigation"
import { getDocument, getDocumentComments, getAuditLogsForDocument } from "@/features/documents/data"
import { DocumentDetailClient } from "@/features/documents/components/document-detail-client"

export default async function DocumentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [document, comments, auditLogs] = await Promise.all([
    getDocument(id),
    getDocumentComments(id),
    getAuditLogsForDocument(id),
  ])
  if (!document) notFound()
  return (
    <DocumentDetailClient
      document={document}
      comments={comments}
      auditLogs={auditLogs}
    />
  )
}
