/**
 * poll-gmail — Supabase Edge Function
 *
 * What it does:
 *   1. Fetches all active email_connections from the DB
 *   2. For each connection:
 *      a. Refreshes the access token if expired
 *      b. Lists Gmail messages with attachments since last_polled_at
 *      c. Skips messages already in email_imports (dedup by gmail_message_id)
 *      d. Downloads processable attachments (PDF, JPEG, PNG, WebP, TIFF)
 *      e. Uploads each attachment to S3
 *      f. Creates a document record (ocr_status = 'queued')
 *      g. Inserts an email_imports row for the message
 *   3. Updates last_polled_at on success, last_error on failure
 *
 * Trigger:
 *   Invoke manually or schedule via Supabase cron:
 *     SELECT cron.schedule('poll-gmail', '*/15 * * * *',
 *       'SELECT net.http_post(url:=''https://<project>.supabase.co/functions/v1/poll-gmail'',
 *        headers:=''{\"Authorization\":\"Bearer <service_key>\"}'')');
 *
 * Environment variables required:
 *   SUPABASE_URL              — auto-injected
 *   SUPABASE_SERVICE_ROLE_KEY — auto-injected
 *   GMAIL_CLIENT_ID
 *   GMAIL_CLIENT_SECRET
 *   AWS_REGION
 *   AWS_ACCESS_KEY_ID
 *   AWS_SECRET_ACCESS_KEY
 *   AWS_S3_BUCKET_NAME
 *
 * Local test:
 *   supabase functions serve poll-gmail
 *   curl -X POST http://localhost:54321/functions/v1/poll-gmail \
 *     -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { decrypt } from "./crypto.ts"

const GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"

// Only process these MIME types
const PROCESSABLE_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
])

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

// ─── helpers ──────────────────────────────────────────────────────────────────

async function refreshToken(
  refreshTokenValue: string
): Promise<{ accessToken: string; expiresAt: string }> {
  const clientId = Deno.env.get("GMAIL_CLIENT_ID")!
  const clientSecret = Deno.env.get("GMAIL_CLIENT_SECRET")!

  const response = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshTokenValue,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
    }),
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Token refresh failed: ${err}`)
  }

  const data = await response.json() as { access_token: string; expires_in: number }
  const expiresAt = new Date(Date.now() + data.expires_in * 1000).toISOString()
  return { accessToken: data.access_token, expiresAt }
}

async function listMessagesWithAttachments(
  accessToken: string,
  sinceDate: Date
): Promise<Array<{ id: string; threadId: string }>> {
  const afterEpoch = Math.floor(sinceDate.getTime() / 1000)
  const query = `has:attachment after:${afterEpoch}`

  const url = new URL(`${GMAIL_API_BASE}/users/me/messages`)
  url.searchParams.set("q", query)
  url.searchParams.set("maxResults", "50")

  const response = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    const err = await response.text()
    throw new Error(`Gmail list messages failed: ${err}`)
  }

  const data = await response.json() as {
    messages?: Array<{ id: string; threadId: string }>
  }
  return data.messages ?? []
}

interface AttachmentInfo {
  filename: string
  mimeType: string
  size: number
  attachmentId: string
}

interface MessageInfo {
  id: string
  threadId: string
  subject: string | null
  sender: string | null
  receivedAt: string | null
  attachments: AttachmentInfo[]
}

async function getMessage(
  accessToken: string,
  messageId: string
): Promise<MessageInfo> {
  const response = await fetch(
    `${GMAIL_API_BASE}/users/me/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) throw new Error(`Failed to fetch Gmail message ${messageId}`)

  const msg = await response.json() as {
    id: string
    threadId: string
    payload?: {
      headers?: Array<{ name: string; value: string }>
      parts?: Array<{
        filename?: string
        mimeType?: string
        body?: { size?: number; attachmentId?: string }
      }>
    }
    internalDate?: string
  }

  const headers = msg.payload?.headers ?? []
  const header = (name: string) =>
    headers.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? null

  const parts = msg.payload?.parts ?? []
  const attachments: AttachmentInfo[] = parts
    .filter((p) => p.filename && p.body?.attachmentId && PROCESSABLE_TYPES.has(p.mimeType ?? ""))
    .map((p) => ({
      filename: p.filename!,
      mimeType: p.mimeType!,
      size: p.body?.size ?? 0,
      attachmentId: p.body!.attachmentId!,
    }))

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: header("subject"),
    sender: header("from"),
    receivedAt: msg.internalDate
      ? new Date(parseInt(msg.internalDate)).toISOString()
      : null,
    attachments,
  }
}

async function downloadAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string
): Promise<Uint8Array | null> {
  const response = await fetch(
    `${GMAIL_API_BASE}/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) return null

  const data = await response.json() as { data?: string }
  if (!data.data) return null

  // Gmail returns base64url
  const base64 = data.data.replace(/-/g, "+").replace(/_/g, "/")
  const binaryStr = atob(base64)
  const bytes = new Uint8Array(binaryStr.length)
  for (let i = 0; i < binaryStr.length; i++) {
    bytes[i] = binaryStr.charCodeAt(i)
  }
  return bytes
}

async function uploadToS3(
  key: string,
  body: Uint8Array,
  mimeType: string
): Promise<void> {
  const region = Deno.env.get("AWS_REGION")!
  const bucket = Deno.env.get("AWS_S3_BUCKET_NAME")!
  const accessKeyId = Deno.env.get("AWS_ACCESS_KEY_ID")!
  const secretAccessKey = Deno.env.get("AWS_SECRET_ACCESS_KEY")!

  const { S3Client, PutObjectCommand } =
    await import("https://esm.sh/@aws-sdk/client-s3@3")

  const s3 = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  })

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: mimeType,
    })
  )
}

function generateS3Key(organizationId: string, filename: string): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, "0")
  const uuid = crypto.randomUUID()
  const sanitized = filename.replace(/[^a-zA-Z0-9._-]/g, "_")
  return `${organizationId}/${year}/${month}/${uuid}/${sanitized}`
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  // Only accept POST
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    })
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  const db = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false },
  })

  // Fetch all active email connections
  const { data: connections, error: connErr } = await db
    .from("email_connections")
    .select("id, organization_id, access_token, refresh_token, token_expires_at, last_polled_at, email_address")
    .eq("is_active", true)

  if (connErr || !connections) {
    return new Response(JSON.stringify({ error: "Failed to fetch email connections" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    })
  }

  const results: Array<{
    connection_id: string
    email: string
    messages_processed: number
    documents_created: number
    error?: string
  }> = []

  for (const conn of connections as Array<{
    id: string
    organization_id: string
    access_token: string
    refresh_token: string
    token_expires_at: string
    last_polled_at: string | null
    email_address: string
  }>) {
    try {
      // Decrypt tokens (gracefully handles unencrypted tokens during migration)
      const hasEncryptionKey = !!Deno.env.get("ENCRYPTION_KEY")
      const decryptToken = async (token: string) => {
        if (!hasEncryptionKey) return token
        try { return await decrypt(token) } catch { return token }
      }

      // Refresh access token if expired (or within 60s of expiry)
      let accessToken = await decryptToken(conn.access_token)
      const expiresAt = new Date(conn.token_expires_at)

      if (expiresAt.getTime() - Date.now() < 60_000) {
        const decryptedRefresh = await decryptToken(conn.refresh_token)
        const refreshed = await refreshToken(decryptedRefresh)
        accessToken = refreshed.accessToken

        await db
          .from("email_connections")
          .update({
            access_token: refreshed.accessToken,
            token_expires_at: refreshed.expiresAt,
          })
          .eq("id", conn.id)
      }

      // Poll since last_polled_at (or 24h ago for first poll)
      const since = conn.last_polled_at
        ? new Date(conn.last_polled_at)
        : new Date(Date.now() - 24 * 60 * 60 * 1000)

      const messageStubs = await listMessagesWithAttachments(accessToken, since)

      let messagesProcessed = 0
      let documentsCreated = 0

      for (const stub of messageStubs) {
        // Dedup — skip if already processed
        const { data: existing } = await db
          .from("email_imports")
          .select("id")
          .eq("organization_id", conn.organization_id)
          .eq("gmail_message_id", stub.id)
          .single()

        if (existing) continue

        // Fetch full message with attachment metadata
        const message = await getMessage(accessToken, stub.id)
        const processableAttachments = message.attachments.filter(
          (a) => PROCESSABLE_TYPES.has(a.mimeType) && a.size <= MAX_FILE_SIZE
        )

        let docsCreatedForMessage = 0

        for (const attachment of processableAttachments) {
          try {
            const bytes = await downloadAttachment(
              accessToken,
              message.id,
              attachment.attachmentId
            )
            if (!bytes) continue

            const s3Key = generateS3Key(conn.organization_id, attachment.filename)
            await uploadToS3(s3Key, bytes, attachment.mimeType)

            // Create document record
            const { data: doc, error: docErr } = await db
              .from("documents")
              .insert({
                organization_id: conn.organization_id,
                name: attachment.filename,
                file_path: s3Key,
                file_size_bytes: attachment.size,
                mime_type: attachment.mimeType,
                document_type: "other",
                ocr_status: "queued",
              })
              .select("id")
              .single()

            if (!docErr && doc) {
              docsCreatedForMessage++
              documentsCreated++

              // Write audit log
              await db.from("audit_logs").insert({
                organization_id: conn.organization_id,
                user_id: null,
                action: "DOCUMENT_UPLOADED",
                entity_type: "document",
                entity_id: (doc as { id: string }).id,
                new_data: {
                  source: "gmail",
                  email_address: conn.email_address,
                  subject: message.subject,
                  sender: message.sender,
                  filename: attachment.filename,
                },
              })
            }
          } catch (attachErr) {
            console.error(
              `Failed to process attachment ${attachment.filename} from message ${stub.id}:`,
              attachErr
            )
          }
        }

        // Record this message as processed (even if 0 docs — prevents re-processing)
        await db.from("email_imports").insert({
          organization_id: conn.organization_id,
          email_connection_id: conn.id,
          gmail_message_id: message.id,
          gmail_thread_id: message.threadId,
          subject: message.subject,
          sender: message.sender,
          received_at: message.receivedAt,
          attachments_found: processableAttachments.length,
          documents_created: docsCreatedForMessage,
        })

        messagesProcessed++
      }

      // Update last_polled_at
      await db
        .from("email_connections")
        .update({ last_polled_at: new Date().toISOString(), last_error: null })
        .eq("id", conn.id)

      results.push({
        connection_id: conn.id,
        email: conn.email_address,
        messages_processed: messagesProcessed,
        documents_created: documentsCreated,
      })
    } catch (connErr) {
      const errMsg = connErr instanceof Error ? connErr.message : "Unknown error"
      console.error(`poll-gmail error for connection ${conn.id}:`, errMsg)

      await db
        .from("email_connections")
        .update({ last_error: errMsg })
        .eq("id", conn.id)

      results.push({
        connection_id: conn.id,
        email: conn.email_address,
        messages_processed: 0,
        documents_created: 0,
        error: errMsg,
      })
    }
  }

  return new Response(
    JSON.stringify({
      polled: connections.length,
      results,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  )
})
