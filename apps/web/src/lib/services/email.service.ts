/**
 * Email Notification Service
 *
 * Sends transactional emails via SMTP using nodemailer.
 * All functions are non-fatal — errors are logged but never thrown.
 *
 * Env vars:
 *   SMTP_HOST     — SMTP server hostname
 *   SMTP_PORT     — SMTP port (default 587)
 *   SMTP_USER     — SMTP username
 *   SMTP_PASS     — SMTP password
 *   SMTP_FROM     — From address (default "Vexera <noreply@vexera.sk>")
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let nodemailerModule: any = null

try {
  // Dynamic import to gracefully degrade if nodemailer is not installed
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  nodemailerModule = require("nodemailer")
} catch {
  console.warn("[email] nodemailer is not installed — email sending will be disabled")
}

interface Transporter {
  sendMail(opts: { from: string; to: string; subject: string; html: string }): Promise<unknown>
}

function getTransporter(): Transporter | null {
  if (!nodemailerModule) return null

  const host = process.env.SMTP_HOST
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

  if (!host || !user || !pass) {
    console.warn("[email] SMTP_HOST, SMTP_USER, or SMTP_PASS not configured — email disabled")
    return null
  }

  return nodemailerModule.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT ?? "587", 10),
    secure: parseInt(process.env.SMTP_PORT ?? "587", 10) === 465,
    auth: { user, pass },
  }) as Transporter
}

const DEFAULT_FROM = "Vexera <noreply@vexera.sk>"

// ─── sendEmail ────────────────────────────────────────────────────────────────

/**
 * Low-level email send via SMTP.
 * Non-fatal: catches errors, logs them, returns { success: false, error }.
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const transporter = getTransporter()
    if (!transporter) {
      console.warn("[email] Transporter not available — skipping email to", to)
      return { success: false, error: "Email transport not configured" }
    }

    await transporter.sendMail({
      from: process.env.SMTP_FROM ?? DEFAULT_FROM,
      to,
      subject,
      html,
    })

    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown email error"
    console.error("[email] Failed to send email:", message, { to, subject })
    return { success: false, error: message }
  }
}

// ─── sendNotificationEmail ───────────────────────────────────────────────────

/**
 * Sends a formatted notification email with Vexera branding.
 * Non-fatal.
 */
export async function sendNotificationEmail(
  to: string,
  notification: { title: string; body: string; actionUrl?: string }
): Promise<void> {
  try {
    const ctaButton = notification.actionUrl
      ? `<a href="${escapeHtml(notification.actionUrl)}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;margin-top:16px;">View Details</a>`
      : ""

    const html = wrapInTemplate(`
      <h2 style="color:#1e293b;margin:0 0 12px;">${escapeHtml(notification.title)}</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 16px;">
        ${escapeHtml(notification.body)}
      </p>
      ${ctaButton}
    `)

    await sendEmail(to, notification.title, html)
  } catch (err) {
    console.error("[email] sendNotificationEmail error:", err)
  }
}

// ─── sendDocumentReadyEmail ──────────────────────────────────────────────────

/**
 * Specific template for document status updates (OCR done, approved, etc.).
 * Non-fatal.
 */
export async function sendDocumentReadyEmail(
  to: string,
  params: { documentName: string; status: string; actionUrl: string }
): Promise<void> {
  try {
    const statusLabel = formatStatus(params.status)

    const html = wrapInTemplate(`
      <h2 style="color:#1e293b;margin:0 0 12px;">Document Status Update</h2>
      <p style="color:#475569;font-size:15px;line-height:1.6;margin:0 0 8px;">
        Your document <strong>${escapeHtml(params.documentName)}</strong> has been updated.
      </p>
      <table style="margin:16px 0;border-collapse:collapse;">
        <tr>
          <td style="padding:8px 16px 8px 0;color:#64748b;font-size:14px;">Status</td>
          <td style="padding:8px 0;">
            <span style="display:inline-block;padding:4px 12px;background-color:#dbeafe;color:#1d4ed8;border-radius:12px;font-size:13px;font-weight:600;">
              ${escapeHtml(statusLabel)}
            </span>
          </td>
        </tr>
      </table>
      <a href="${escapeHtml(params.actionUrl)}" style="display:inline-block;padding:12px 24px;background-color:#2563eb;color:#ffffff;text-decoration:none;border-radius:6px;font-weight:600;margin-top:8px;">
        View Document
      </a>
    `)

    await sendEmail(to, `Document Update: ${params.documentName}`, html)
  } catch (err) {
    console.error("[email] sendDocumentReadyEmail error:", err)
  }
}

// ─── sendWeeklyDigest ────────────────────────────────────────────────────────

/**
 * Weekly summary email for accountants.
 * Non-fatal.
 */
export async function sendWeeklyDigest(
  to: string,
  params: {
    userName: string
    docsProcessed: number
    autoProcessed: number
    hoursSaved: number
    topActions: string[]
  }
): Promise<void> {
  try {
    const autoRate =
      params.docsProcessed > 0
        ? Math.round((params.autoProcessed / params.docsProcessed) * 100)
        : 0

    const actionItems = params.topActions.length > 0
      ? `
        <h3 style="color:#1e293b;margin:24px 0 8px;font-size:15px;">Action Items</h3>
        <ul style="color:#475569;font-size:14px;line-height:1.8;padding-left:20px;margin:0;">
          ${params.topActions.map((a) => `<li>${escapeHtml(a)}</li>`).join("")}
        </ul>
      `
      : ""

    const html = wrapInTemplate(`
      <h2 style="color:#1e293b;margin:0 0 4px;">Weekly Digest</h2>
      <p style="color:#64748b;font-size:14px;margin:0 0 20px;">
        Hi ${escapeHtml(params.userName)}, here's your weekly summary.
      </p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr>
          <td style="padding:16px;background:#f8fafc;border-radius:8px;text-align:center;width:33%;">
            <div style="font-size:28px;font-weight:700;color:#1e293b;">${params.docsProcessed}</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">Docs Processed</div>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:16px;background:#f8fafc;border-radius:8px;text-align:center;width:33%;">
            <div style="font-size:28px;font-weight:700;color:#16a34a;">${autoRate}%</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">Auto-Processed</div>
          </td>
          <td style="width:8px;"></td>
          <td style="padding:16px;background:#f8fafc;border-radius:8px;text-align:center;width:33%;">
            <div style="font-size:28px;font-weight:700;color:#2563eb;">${params.hoursSaved}h</div>
            <div style="font-size:12px;color:#64748b;margin-top:4px;">Hours Saved</div>
          </td>
        </tr>
      </table>

      ${actionItems}
    `)

    await sendEmail(to, `Vexera Weekly Digest - ${params.docsProcessed} docs processed`, html)
  } catch (err) {
    console.error("[email] sendWeeklyDigest error:", err)
  }
}

// ─── Template helpers ────────────────────────────────────────────────────────

function wrapInTemplate(bodyContent: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table role="presentation" width="100%" style="background-color:#f1f5f9;padding:32px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="560" style="max-width:560px;width:100%;">
          <!-- Header -->
          <tr>
            <td style="padding:24px 0;text-align:center;">
              <span style="font-size:24px;font-weight:700;color:#1e293b;letter-spacing:-0.5px;">VEXERA</span>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="background:#ffffff;border-radius:12px;padding:32px;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 0;text-align:center;">
              <p style="color:#94a3b8;font-size:12px;margin:0 0 4px;">
                Vexera - Slovak Accounting Automation
              </p>
              <p style="color:#94a3b8;font-size:11px;margin:0;">
                <a href="#" style="color:#94a3b8;text-decoration:underline;">Unsubscribe</a> from these emails
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

function formatStatus(status: string): string {
  const map: Record<string, string> = {
    new: "New",
    auto_processed: "Auto-Processed",
    awaiting_review: "Awaiting Review",
    approved: "Approved",
    awaiting_client: "Awaiting Client",
    archived: "Archived",
  }
  return map[status] ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}
