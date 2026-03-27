/**
 * OCR Service
 *
 * Processes documents with ocr_status='queued' using Google Cloud Vision API.
 * Extracts structured fields (supplier, amounts, dates, IBAN, VS) from raw OCR text
 * using regex patterns tailored for Slovak document formats.
 *
 * All operations enforce organization_id scoping at the service layer.
 *
 * Usage (from API routes or Edge Functions):
 *   const supabase = await createClient()
 *   await processDocument(supabase, orgId, documentId)
 *   await processAllQueued(supabase, orgId)
 */

import { GetObjectCommand } from "@aws-sdk/client-s3"
import { getS3Client, getS3BucketName } from "@/lib/s3/client"
import { createNotificationForAllMembers } from "@/features/notifications/service"
import { writeAuditLog } from "@/shared/services/audit.server"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { OcrExtractedFields } from "@vexera/types"

// ─── Google Cloud Vision API ────────────────────────────────────────────────

const VISION_API_URL = "https://vision.googleapis.com/v1/images:annotate"

interface VisionAnnotateResponse {
  responses: Array<{
    textAnnotations?: Array<{
      description: string
      locale?: string
    }>
    error?: {
      code: number
      message: string
    }
  }>
}

/**
 * Call Google Cloud Vision TEXT_DETECTION on a file buffer.
 * Returns the full extracted text or null on failure.
 */
async function callGoogleVision(fileBuffer: Buffer, mimeType: string): Promise<string | null> {
  const apiKey = process.env.GOOGLE_VISION_API_KEY
  if (!apiKey) {
    throw new Error("GOOGLE_VISION_API_KEY is not configured")
  }

  const base64Content = fileBuffer.toString("base64")

  // For PDFs, use DOCUMENT_TEXT_DETECTION; for images, use TEXT_DETECTION
  const featureType = mimeType === "application/pdf"
    ? "DOCUMENT_TEXT_DETECTION"
    : "TEXT_DETECTION"

  const requestBody = {
    requests: [
      {
        image: { content: base64Content },
        features: [{ type: featureType, maxResults: 1 }],
      },
    ],
  }

  const response = await fetch(`${VISION_API_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text()
    throw new Error(`Google Vision API error (${response.status}): ${errorText}`)
  }

  const data = (await response.json()) as VisionAnnotateResponse

  if (data.responses[0]?.error) {
    throw new Error(
      `Vision API response error: ${data.responses[0].error.message}`
    )
  }

  const annotations = data.responses[0]?.textAnnotations
  if (!annotations || annotations.length === 0) {
    return null
  }

  // The first annotation contains the full text
  return annotations[0].description ?? null
}

// ─── S3 Download ────────────────────────────────────────────────────────────

/**
 * Download a file from S3 directly using GetObjectCommand.
 * Returns the file contents as a Buffer.
 */
async function downloadFromS3(filePath: string): Promise<Buffer> {
  const s3 = getS3Client()
  const bucket = getS3BucketName()

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: filePath,
  })

  const response = await s3.send(command)

  if (!response.Body) {
    throw new Error(`S3 returned empty body for key: ${filePath}`)
  }

  // Convert the readable stream to a Buffer
  const chunks: Uint8Array[] = []
  const stream = response.Body as AsyncIterable<Uint8Array>
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

// ─── Text Parsing (Slovak document formats) ─────────────────────────────────

/**
 * Parse raw OCR text and extract structured fields.
 * Uses regex patterns for Slovak invoice/document formats.
 *
 * This function is pure and testable — no side effects.
 */
export function parseOcrText(rawText: string): OcrExtractedFields {
  const text = rawText ?? ""

  return {
    supplier_name: extractSupplierName(text),
    document_number: extractDocumentNumber(text),
    issue_date: extractDate(text, "issue"),
    due_date: extractDate(text, "due"),
    total_amount: extractAmount(text, "total"),
    vat_amount: extractAmount(text, "vat"),
    vat_rate: extractVatRate(text),
    currency: extractCurrency(text),
    iban: extractIban(text),
    variable_symbol: extractVariableSymbol(text),
    raw_text: text.substring(0, 10_000), // Cap raw_text storage
  }
}

/**
 * Extract supplier/vendor name from common Slovak invoice patterns.
 * Looks for "Dodavatel:", "Predavajuci:", "Dodavatel:", or the first company-like line.
 */
function extractSupplierName(text: string): string | null {
  // Pattern: "Dodavatel:" or "Predavajuci:" followed by the company name
  const supplierPatterns = [
    /(?:Dodávate[lľ]|Predávajúci|Dodavatel|Supplier|Vendor)\s*[:\-]\s*(.+)/i,
    /(?:Firma|Obchodné meno|Názov)\s*[:\-]\s*(.+)/i,
  ]

  for (const pattern of supplierPatterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      // Clean up: take the line content, trim whitespace
      const name = match[1].trim().split(/\n/)[0].trim()
      if (name.length > 2 && name.length < 200) return name
    }
  }

  return null
}

/**
 * Extract document/invoice number.
 * Looks for patterns like "Cislo faktury:", "Fa c.:", "Invoice No:", etc.
 */
function extractDocumentNumber(text: string): string | null {
  const patterns = [
    /(?:Číslo faktúry|Fa\.?\s*č|Faktúra č|Invoice\s*(?:No|Number|#)|Doklad č)\s*[.:\-]\s*([A-Za-z0-9\-/]+)/i,
    /(?:č\.\s*dokladu|číslo dokladu)\s*[:\-]\s*([A-Za-z0-9\-/]+)/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      return match[1].trim()
    }
  }

  return null
}

/**
 * Extract a date (issue or due) from common Slovak patterns.
 * Supports dd.mm.yyyy, dd/mm/yyyy formats and converts to ISO date (YYYY-MM-DD).
 */
function extractDate(text: string, type: "issue" | "due"): string | null {
  const issuePatterns = [
    /(?:Dátum vystavenia|Dátum vy[sš]tavenia|Date of issue|Vystavené dňa|Dátum)\s*[:\-]\s*(\d{1,2})[./](\d{1,2})[./](\d{4})/i,
    /(?:Dňa|Zo dňa)\s*[:\-]?\s*(\d{1,2})[./](\d{1,2})[./](\d{4})/i,
  ]

  const duePatterns = [
    /(?:Dátum splatnosti|Splatn[oó]s[tť]|Due\s*date|Splatné do|Uhradiť do)\s*[:\-]\s*(\d{1,2})[./](\d{1,2})[./](\d{4})/i,
  ]

  const patterns = type === "issue" ? issuePatterns : duePatterns

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match) {
      const day = match[1].padStart(2, "0")
      const month = match[2].padStart(2, "0")
      const year = match[3]
      // Basic validation
      const d = parseInt(day)
      const m = parseInt(month)
      if (d >= 1 && d <= 31 && m >= 1 && m <= 12) {
        return `${year}-${month}-${day}`
      }
    }
  }

  return null
}

/**
 * Extract an amount (total or VAT).
 * Handles Slovak number formats: "1 234,56" or "1234.56".
 */
function extractAmount(text: string, type: "total" | "vat"): number | null {
  const totalPatterns = [
    /(?:Celkom|Spolu|Total|Suma na úhradu|K úhrade|Celková suma|Suma)\s*[:\-]?\s*([\d\s]+[,.][\d]{2})/i,
    /(?:Celkom s DPH|Spolu s DPH|Total incl\.?\s*VAT)\s*[:\-]?\s*([\d\s]+[,.][\d]{2})/i,
  ]

  const vatPatterns = [
    /(?:DPH|VAT|Daň)\s*[:\-]?\s*([\d\s]+[,.][\d]{2})/i,
    /(?:Suma DPH|VAT amount)\s*[:\-]?\s*([\d\s]+[,.][\d]{2})/i,
  ]

  const patterns = type === "total" ? totalPatterns : vatPatterns

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) {
      return parseSlovakAmount(match[1])
    }
  }

  return null
}

/**
 * Parse a Slovak-formatted number string into a numeric value.
 * "1 234,56" -> 1234.56
 * "1234.56" -> 1234.56
 */
function parseSlovakAmount(amountStr: string): number | null {
  // Remove spaces (thousand separators)
  let cleaned = amountStr.replace(/\s/g, "")
  // Replace comma with dot (decimal separator)
  cleaned = cleaned.replace(",", ".")

  const value = parseFloat(cleaned)
  if (isNaN(value)) return null
  return Math.round(value * 100) / 100 // Round to 2 decimals
}

/**
 * Extract VAT rate from text.
 * Common Slovak rates: 20%, 10%, 5%.
 */
function extractVatRate(text: string): number | null {
  const match = text.match(/(?:DPH|VAT|Sadzba)\s*[:\-]?\s*(\d{1,2})\s*%/i)
  if (match?.[1]) {
    const rate = parseInt(match[1])
    if ([20, 10, 5, 0].includes(rate)) return rate
  }
  return null
}

/**
 * Extract currency code.
 * Defaults to EUR for Slovak documents if no explicit currency found.
 */
function extractCurrency(text: string): string | null {
  // Look for explicit currency mentions
  const match = text.match(/\b(EUR|USD|CZK|GBP|CHF|PLN|HUF)\b/i)
  if (match?.[1]) return match[1].toUpperCase()

  // Check for euro symbol
  if (/€/.test(text)) return "EUR"
  if (/\$/.test(text)) return "USD"
  if (/Kč/.test(text)) return "CZK"

  return null
}

/**
 * Extract IBAN, specifically looking for Slovak IBANs (SK pattern).
 * Also handles other EU IBANs.
 */
function extractIban(text: string): string | null {
  // IBAN pattern: 2 letter country code + 2 check digits + up to 30 alphanumeric
  // Allow spaces between groups
  const match = text.match(/\b([A-Z]{2}\d{2}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{4}\s?\d{0,4})\b/)
  if (match?.[1]) {
    // Remove spaces and validate length
    const iban = match[1].replace(/\s/g, "")
    if (iban.length >= 15 && iban.length <= 34) return iban
  }
  return null
}

/**
 * Extract variable symbol (variabilny symbol / VS).
 * Typically a numeric string of up to 10 digits.
 */
function extractVariableSymbol(text: string): string | null {
  const patterns = [
    /(?:Variabiln[yý]\s*symbol|VS|Var\.?\s*sym)\s*[.:\-]\s*(\d{1,10})/i,
    /(?:Variable\s*symbol)\s*[:\-]\s*(\d{1,10})/i,
  ]

  for (const pattern of patterns) {
    const match = text.match(pattern)
    if (match?.[1]) return match[1]
  }

  return null
}

// ─── processDocument ────────────────────────────────────────────────────────

/**
 * Process OCR for a single document.
 *
 * 1. Set ocr_status = 'processing'
 * 2. Download file from S3
 * 3. Call Google Cloud Vision
 * 4. Parse extracted text into structured fields
 * 5. Update DB with results (ocr_status = 'done')
 * 6. On failure: set ocr_status = 'failed', create notification
 */
export async function processDocument(
  supabase: SupabaseClient,
  organizationId: string,
  documentId: string
): Promise<{ success: boolean; error?: string }> {
  try {
    // Fetch the document, scoped to org
    const { data: doc, error: fetchError } = await supabase
      .from("documents")
      .select("id, file_path, mime_type, name, uploaded_by, organization_id")
      .eq("id", documentId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .single()

    if (fetchError || !doc) {
      return { success: false, error: "Document not found" }
    }

    const document = doc as unknown as {
      id: string
      file_path: string
      mime_type: string | null
      name: string
      uploaded_by: string | null
      organization_id: string
    }

    // Mark as processing
    await supabase
      .from("documents")
      .update({ ocr_status: "processing" })
      .eq("id", documentId)
      .eq("organization_id", organizationId)

    // Download file from S3
    const fileBuffer = await downloadFromS3(document.file_path)

    // Call Google Cloud Vision
    const rawText = await callGoogleVision(
      fileBuffer,
      document.mime_type ?? "application/octet-stream"
    )

    if (!rawText) {
      // No text found — still mark as done with empty fields
      await supabase
        .from("documents")
        .update({
          ocr_status: "done",
          ocr_data: { raw_text: null } as unknown as Record<string, unknown>,
          ocr_processed_at: new Date().toISOString(),
        })
        .eq("id", documentId)
        .eq("organization_id", organizationId)

      return { success: true }
    }

    // Parse extracted text
    const extracted = parseOcrText(rawText)

    // Update document with OCR results
    await supabase
      .from("documents")
      .update({
        ocr_status: "done",
        ocr_data: extracted as unknown as Record<string, unknown>,
        ocr_processed_at: new Date().toISOString(),
        supplier_name: extracted.supplier_name,
        document_number: extracted.document_number,
        issue_date: extracted.issue_date,
        due_date: extracted.due_date,
        total_amount: extracted.total_amount,
        vat_amount: extracted.vat_amount,
        vat_rate: extracted.vat_rate,
      })
      .eq("id", documentId)
      .eq("organization_id", organizationId)

    // Audit log
    await writeAuditLog(supabase, {
      organizationId,
      userId: document.uploaded_by,
      action: "DOCUMENT_OCR_COMPLETED",
      entityType: "document",
      entityId: documentId,
      newData: {
        supplier_name: extracted.supplier_name,
        document_number: extracted.document_number,
        total_amount: extracted.total_amount,
      },
    })

    // Notify all org members
    await createNotificationForAllMembers(supabase, {
      organizationId,
      type: "document_ocr_done",
      title: `OCR completed: ${document.name}`,
      body: extracted.supplier_name
        ? `Supplier: ${extracted.supplier_name}, Amount: ${extracted.total_amount ?? "N/A"}`
        : `Text extracted from ${document.name}`,
      entityType: "document",
      entityId: documentId,
      metadata: {
        document_name: document.name,
        supplier_name: extracted.supplier_name,
        total_amount: extracted.total_amount,
      },
    })

    return { success: true }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Unknown OCR error"
    console.error(`[ocr] Failed to process document ${documentId}:`, errorMessage)

    // Mark as failed
    try {
      await supabase
        .from("documents")
        .update({
          ocr_status: "failed",
          ocr_data: { error: errorMessage } as unknown as Record<string, unknown>,
          ocr_processed_at: new Date().toISOString(),
        })
        .eq("id", documentId)
        .eq("organization_id", organizationId)

      // Fetch doc name for notification
      const { data: failedDoc } = await supabase
        .from("documents")
        .select("name, uploaded_by")
        .eq("id", documentId)
        .eq("organization_id", organizationId)
        .single()

      const docInfo = failedDoc as unknown as { name: string; uploaded_by: string | null } | null

      await writeAuditLog(supabase, {
        organizationId,
        userId: docInfo?.uploaded_by ?? null,
        action: "DOCUMENT_OCR_FAILED",
        entityType: "document",
        entityId: documentId,
        newData: { error: errorMessage },
      })

      await createNotificationForAllMembers(supabase, {
        organizationId,
        type: "document_ocr_failed",
        title: `OCR failed: ${docInfo?.name ?? documentId}`,
        body: errorMessage,
        entityType: "document",
        entityId: documentId,
      })
    } catch (notifyErr) {
      console.error("[ocr] Failed to update failure state:", notifyErr)
    }

    return { success: false, error: errorMessage }
  }
}

// ─── processAllQueued ───────────────────────────────────────────────────────

/**
 * Batch process all documents with ocr_status='queued' for an organization.
 * Returns a summary of processed and failed counts.
 */
export async function processAllQueued(
  supabase: SupabaseClient,
  organizationId: string
): Promise<{ processed: number; failed: number; total: number }> {
  // Fetch all queued documents
  const { data: queuedDocs, error } = await supabase
    .from("documents")
    .select("id")
    .eq("organization_id", organizationId)
    .eq("ocr_status", "queued")
    .is("deleted_at", null)
    .order("created_at", { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch queued documents: ${error.message}`)
  }

  const docs = (queuedDocs ?? []) as unknown as Array<{ id: string }>
  let processed = 0
  let failed = 0

  // Process sequentially to avoid rate limits
  for (const doc of docs) {
    const result = await processDocument(supabase, organizationId, doc.id)
    if (result.success) {
      processed++
    } else {
      failed++
    }
  }

  return {
    processed,
    failed,
    total: docs.length,
  }
}
