/**
 * Gmail Service — OAuth2 token management and email fetching
 *
 * Handles:
 *   - OAuth2 authorization URL generation
 *   - Authorization code → token exchange
 *   - Access token refresh (using refresh_token)
 *   - Listing unread messages since a given date
 *   - Downloading attachment content
 *
 * Environment variables required:
 *   GMAIL_CLIENT_ID       — Google OAuth2 client ID
 *   GMAIL_CLIENT_SECRET   — Google OAuth2 client secret
 *   GMAIL_REDIRECT_URI    — e.g. https://app.vexera.sk/api/email/callback
 *
 * Gmail API scopes used:
 *   https://www.googleapis.com/auth/gmail.readonly
 */

const GMAIL_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
const GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token"
const GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1"

const SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
  "https://www.googleapis.com/auth/userinfo.profile",
].join(" ")

function getConfig() {
  const clientId = process.env.GMAIL_CLIENT_ID
  const clientSecret = process.env.GMAIL_CLIENT_SECRET
  const redirectUri = process.env.GMAIL_REDIRECT_URI

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Gmail OAuth2 not configured. Set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REDIRECT_URI."
    )
  }

  return { clientId, clientSecret, redirectUri }
}

// ─── OAuth2 flow ──────────────────────────────────────────────────────────────

/**
 * Build the Google OAuth2 authorization URL.
 * The state param carries a JSON-encoded object with the organizationId and
 * a random nonce for CSRF protection.
 */
export function buildAuthorizationUrl(
  organizationId: string,
  nonce: string,
): string {
  const { clientId, redirectUri } = getConfig()

  const state = JSON.stringify({ orgId: organizationId, nonce })

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: SCOPES,
    access_type: "offline",    // ensures we get a refresh_token
    prompt: "consent",         // force consent to always get refresh_token
    state,
  })

  return `${GMAIL_AUTH_URL}?${params.toString()}`
}

export interface GmailTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date     // absolute expiry time
  email: string
  googleUserId: string
}

/**
 * Exchange an authorization code for access + refresh tokens.
 * Called once during the OAuth2 callback.
 */
export async function exchangeCodeForTokens(code: string): Promise<GmailTokens> {
  const { clientId, clientSecret, redirectUri } = getConfig()

  const tokenResponse = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }),
  })

  if (!tokenResponse.ok) {
    const err = await tokenResponse.text()
    throw new Error(`Token exchange failed: ${err}`)
  }

  const tokenData = await tokenResponse.json() as {
    access_token: string
    refresh_token: string
    expires_in: number
    id_token?: string
  }

  // Decode id_token to get user info (email + sub)
  const userInfo = await fetchGoogleUserInfo(tokenData.access_token)

  return {
    accessToken: tokenData.access_token,
    refreshToken: tokenData.refresh_token,
    expiresAt: new Date(Date.now() + tokenData.expires_in * 1000),
    email: userInfo.email,
    googleUserId: userInfo.id,
  }
}

/**
 * Use the refresh token to get a fresh access token.
 * Call this before any Gmail API request if expiresAt is in the past.
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  accessToken: string
  expiresAt: Date
}> {
  const { clientId, clientSecret } = getConfig()

  const response = await fetch(GMAIL_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      refresh_token: refreshToken,
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
  return {
    accessToken: data.access_token,
    expiresAt: new Date(Date.now() + data.expires_in * 1000),
  }
}

// ─── User info ────────────────────────────────────────────────────────────────

interface GoogleUserInfo {
  id: string
  email: string
  name: string
}

async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleUserInfo> {
  const response = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) throw new Error("Failed to fetch Google user info")
  return response.json() as Promise<GoogleUserInfo>
}

// ─── Gmail message listing ────────────────────────────────────────────────────

export interface GmailMessageStub {
  id: string
  threadId: string
}

/**
 * List Gmail message IDs that have attachments and arrived since `sinceDate`.
 * Uses the Gmail search query: `has:attachment after:<epoch_seconds>`.
 */
export async function listMessagesWithAttachments(
  accessToken: string,
  sinceDate: Date
): Promise<GmailMessageStub[]> {
  // Gmail query: messages with attachments received after date
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

  const data = await response.json() as { messages?: GmailMessageStub[] }
  return data.messages ?? []
}

// ─── Message + attachment fetching ───────────────────────────────────────────

export interface GmailAttachment {
  filename: string
  mimeType: string
  size: number
  attachmentId: string
  messageId: string
}

export interface GmailMessage {
  id: string
  threadId: string
  subject: string | null
  sender: string | null
  receivedAt: Date | null
  attachments: GmailAttachment[]
}

/**
 * Fetch full message metadata and list of attachments.
 * Does NOT download attachment content — use downloadAttachment for that.
 */
export async function getMessage(
  accessToken: string,
  messageId: string
): Promise<GmailMessage> {
  const response = await fetch(
    `${GMAIL_API_BASE}/users/me/messages/${messageId}?format=metadata&metadataHeaders=Subject&metadataHeaders=From&metadataHeaders=Date`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) {
    throw new Error(`Failed to fetch Gmail message ${messageId}`)
  }

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
  const attachments: GmailAttachment[] = parts
    .filter((p) => p.filename && p.body?.attachmentId)
    .map((p) => ({
      filename: p.filename!,
      mimeType: p.mimeType ?? "application/octet-stream",
      size: p.body?.size ?? 0,
      attachmentId: p.body!.attachmentId!,
      messageId: msg.id,
    }))

  const internalDate = msg.internalDate
    ? new Date(parseInt(msg.internalDate))
    : null

  return {
    id: msg.id,
    threadId: msg.threadId,
    subject: header("subject"),
    sender: header("from"),
    receivedAt: internalDate,
    attachments,
  }
}

const PROCESSABLE_ATTACHMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/tiff",
])

/**
 * Download the raw bytes of a Gmail attachment.
 * Returns null if the attachment MIME type is not processable.
 */
export async function downloadAttachment(
  accessToken: string,
  messageId: string,
  attachmentId: string,
  mimeType: string
): Promise<Buffer | null> {
  if (!PROCESSABLE_ATTACHMENT_TYPES.has(mimeType)) return null

  const response = await fetch(
    `${GMAIL_API_BASE}/users/me/messages/${messageId}/attachments/${attachmentId}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  )

  if (!response.ok) {
    throw new Error(`Failed to download attachment ${attachmentId}`)
  }

  const data = await response.json() as { data?: string }
  if (!data.data) return null

  // Gmail returns base64url-encoded data
  const base64 = data.data.replace(/-/g, "+").replace(/_/g, "/")
  return Buffer.from(base64, "base64")
}
