/**
 * process-ocr — Supabase Edge Function
 *
 * What it does:
 *   1. Receives { document_id, organization_id } in the request body
 *   2. Marks document ocr_status = 'processing'
 *   3. Generates a presigned GET URL for the document's S3 file
 *   4. Calls the configured OCR provider (mock | google_vision)
 *   5. Saves structured ocr_data + ocr_status = 'done'
 *   6. On failure: retries up to 3× with exponential backoff,
 *      then sets ocr_status = 'failed'
 *   7. Writes an audit_log entry on completion
 *
 * Trigger:
 *   Called from the client (useUploadDocument hook) immediately after
 *   the document record is created in the DB. Fire-and-forget from client.
 *
 * Environment variables required:
 *   SUPABASE_URL              — auto-injected by Supabase
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected by Supabase
 *   SUPABASE_ANON_KEY         — auto-injected by Supabase
 *   AWS_REGION                — for presigned URL generation
 *   AWS_ACCESS_KEY_ID         — for presigned URL generation
 *   AWS_SECRET_ACCESS_KEY     — for presigned URL generation
 *   AWS_S3_BUCKET_NAME        — S3 bucket name
 *   OCR_PROVIDER              — 'mock' | 'google_vision' (default: 'mock')
 *   GOOGLE_VISION_API_KEY     — required when OCR_PROVIDER=google_vision
 *
 * Local test:
 *   supabase functions serve process-ocr
 *   curl -X POST http://localhost:54321/functions/v1/process-ocr \
 *     -H "Authorization: Bearer <ANON_KEY>" \
 *     -H "Content-Type: application/json" \
 *     -d '{"document_id":"<uuid>","organization_id":"<uuid>"}'
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { getOcrProvider } from "./ocr-providers.ts"

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
}

const MAX_RETRIES = 3
const RETRY_BASE_MS = 2000

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

async function getS3PresignedUrl(filePath: string): Promise<string> {
  const region = Deno.env.get("AWS_REGION")!
  const bucket = Deno.env.get("AWS_S3_BUCKET_NAME")!
  const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID")!
  const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY")!

  // Build AWS Signature V4 presigned URL (valid for 5 minutes)
  // Using the AWS SDK for Deno-compatible ESM import
  const { S3Client, GetObjectCommand } =
    await import("https://esm.sh/@aws-sdk/client-s3@3")
  const { getSignedUrl } =
    await import("https://esm.sh/@aws-sdk/s3-request-presigner@3")

  const s3 = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  return getSignedUrl(s3, new GetObjectCommand({ Bucket: bucket, Key: filePath }), {
    expiresIn: 300,
  })
}

Deno.serve(async (req: Request) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  let documentId: string | undefined
  let organizationId: string | undefined

  try {
    // Verify auth
    const authHeader = req.headers.get("Authorization")
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing Authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    )
    const { data: { user }, error: authErr } = await userClient.auth.getUser()
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Parse body
    const body = await req.json() as { document_id?: string; organization_id?: string }
    documentId = body.document_id
    organizationId = body.organization_id

    if (!documentId || !organizationId) {
      return new Response(
        JSON.stringify({ error: "document_id and organization_id are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Fetch the document
    const { data: doc, error: fetchErr } = await db
      .from("documents")
      .select("id, file_path, mime_type, ocr_status, organization_id")
      .eq("id", documentId)
      .eq("organization_id", organizationId)
      .is("deleted_at", null)
      .single()

    if (fetchErr || !doc) {
      return new Response(
        JSON.stringify({ error: "Document not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Skip if already processed or currently processing
    if (doc.ocr_status === "done" || doc.ocr_status === "processing") {
      return new Response(
        JSON.stringify({ message: `OCR already ${doc.ocr_status}`, document_id: documentId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Only process PDF and images
    const processableMimes = ["application/pdf", "image/jpeg", "image/png", "image/webp", "image/tiff"]
    if (doc.mime_type && !processableMimes.includes(doc.mime_type)) {
      await db.from("documents").update({ ocr_status: "failed" }).eq("id", documentId)
      return new Response(
        JSON.stringify({ error: `Unsupported mime type: ${doc.mime_type}` }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Mark as processing
    await db.from("documents").update({ ocr_status: "processing" }).eq("id", documentId)

    // Retry loop
    let lastError: Error | null = null
    let ocrResult = null

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        const presignedUrl = await getS3PresignedUrl(doc.file_path)
        const provider = getOcrProvider()
        ocrResult = await provider.extractFromUrl(presignedUrl, doc.mime_type ?? "application/pdf")
        lastError = null
        break
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        console.error(`OCR attempt ${attempt + 1}/${MAX_RETRIES} failed:`, lastError.message)
        if (attempt < MAX_RETRIES - 1) {
          await sleep(RETRY_BASE_MS * Math.pow(2, attempt)) // 2s, 4s, 8s
        }
      }
    }

    if (!ocrResult) {
      // All retries exhausted
      await db.from("documents").update({
        ocr_status: "failed",
        ocr_data: { error: lastError?.message ?? "Unknown OCR error" },
      }).eq("id", documentId)

      await db.from("audit_logs").insert({
        organization_id: organizationId,
        user_id: user.id,
        action: "DOCUMENT_OCR_FAILED",
        entity_type: "document",
        entity_id: documentId,
        new_data: { error: lastError?.message },
      })

      return new Response(
        JSON.stringify({ error: `OCR failed after ${MAX_RETRIES} attempts: ${lastError?.message}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      )
    }

    // Save OCR results
    await db.from("documents").update({
      ocr_status: "done",
      ocr_data: ocrResult,
      ocr_processed_at: new Date().toISOString(),
    }).eq("id", documentId)

    // Audit log
    await db.from("audit_logs").insert({
      organization_id: organizationId,
      user_id: user.id,
      action: "DOCUMENT_OCR_COMPLETED",
      entity_type: "document",
      entity_id: documentId,
      new_data: {
        ocr_status: "done",
        confidence: ocrResult.confidence,
        invoice_number: ocrResult.invoice_number,
        total: ocrResult.total,
      },
    })

    return new Response(
      JSON.stringify({
        message: "OCR completed successfully",
        document_id: documentId,
        ocr_data: ocrResult,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  } catch (err) {
    console.error("process-ocr fatal error:", err)

    // Mark document as failed if we know its ID
    if (documentId) {
      await db
        .from("documents")
        .update({ ocr_status: "failed" })
        .eq("id", documentId)
        .catch(() => { /* ignore — best effort */ })
    }

    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    )
  }
})
