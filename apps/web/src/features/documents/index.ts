// ─── Actions ──────────────────────────────────────────────────────────────────
export {
  deleteDocumentAction,
  linkDocumentToInvoiceAction,
  updateDocumentStatusAction,
  batchApproveDocumentsAction,
  updateDocumentMetadataAction,
  addDocumentCommentAction,
} from "./actions"

export { createInvoiceFromOcrAction } from "./actions-ocr"

// ─── Data (server-side fetchers) ──────────────────────────────────────────────
export {
  getDocuments,
  getDocument,
  getDocumentComments,
  getAuditLogsForDocument,
} from "./data"
export type {
  DocumentRow,
  DocumentFilters,
  DocumentDetail,
  DocumentComment,
  AuditLogEntry,
} from "./data"

// ─── Hooks (client-side) ──────────────────────────────────────────────────────
export { useUploadDocument, getDocumentDownloadUrl } from "./hooks"

// ─── Services ─────────────────────────────────────────────────────────────────
export {
  createDocument,
  getDocument as getDocumentService,
  listDocuments,
  updateDocument,
  deleteDocument,
} from "./service"
export type {
  CreateDocumentInput,
  DocumentRecord,
  ListDocumentsFilters,
} from "./service"

export { processDocument, processAllQueued, parseOcrText } from "./ocr.service"

export {
  computeFileHash,
  findDuplicates,
  checkBeforeUpload,
} from "./duplicate-detection.service"

export {
  getUploadPresignedUrl,
  getDownloadPresignedUrl,
  UPLOAD_EXPIRES_IN,
  DOWNLOAD_EXPIRES_IN,
} from "./storage.service"

// ─── Components ───────────────────────────────────────────────────────────────
export { DocumentDetailClient } from "./components/document-detail-client"
export { DocumentStatusBadge } from "./components/document-status-badge"
export { DocumentUploader } from "./components/document-uploader"
export { DocumentsGridClient } from "./components/documents-grid-client"
export { DocumentsTableClient } from "./components/documents-table-client"
export { OcrExtractionReview } from "./components/ocr-extraction-review"
