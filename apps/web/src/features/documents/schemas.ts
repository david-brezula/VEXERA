import { z } from "zod"

export const documentUploadSchema = z.object({
  name: z.string().min(1, "Document name is required"),
  document_type: z.enum([
    "invoice_issued",
    "invoice_received",
    "receipt",
    "contract",
    "bank_statement",
    "tax_document",
    "other",
  ]),
  invoice_id: z.string().uuid().optional().or(z.literal("")),
})

export type DocumentUploadFormValues = z.infer<typeof documentUploadSchema>

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  invoice_issued: "Issued Invoice",
  invoice_received: "Received Invoice",
  receipt: "Receipt",
  contract: "Contract",
  bank_statement: "Bank Statement",
  tax_document: "Tax Document",
  other: "Other",
}

export const ACCEPTED_MIME_TYPES = [
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
]

export const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024 // 20 MB
