/**
 * Invoice Email Service (system-level)
 *
 * Sends invoice emails with PDF attachments without requiring cookie-based auth.
 * Used by the queue processor for auto-send from recurring invoices.
 *
 * Unlike sendInvoiceEmailAction (server action), this function accepts a
 * supabase client and orgId directly, making it safe to call from cron/queue
 * contexts where no user session exists.
 */

import { createElement } from "react"
import { renderToBuffer } from "@react-pdf/renderer"
import { Resend } from "resend"
import QRCode from "qrcode"
import { InvoicePdfDocument } from "./components/invoice-pdf"
import { createTracking, getTrackingPixelHtml } from "@/features/notifications/email-tracking.service"
import { encodePayBySquare } from "@/lib/pay-by-square"
import type { SupabaseClient } from "@supabase/supabase-js"
import type { InvoiceDetail } from "./data"
import { DEFAULT_TEMPLATE_SETTINGS, type InvoiceTemplateSettings } from "./types"

function getResend() {
  return new Resend(process.env.RESEND_API_KEY)
}

/**
 * Fetch a full invoice (with items + org logo) using a system supabase client.
 * Does NOT depend on getActiveOrgId() / cookies.
 */
async function fetchInvoiceForEmail(
  supabase: SupabaseClient,
  invoiceId: string
): Promise<InvoiceDetail | null> {
  const { data, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*), organization:organizations!organization_id(logo_url, invoice_template_settings)")
    .eq("id", invoiceId)
    .is("deleted_at", null)
    .single()

  if (error || !data) {
    console.error("[invoice-email-service] Failed to fetch invoice:", error?.message)
    return null
  }

  return data as InvoiceDetail
}

/**
 * Send an invoice email from a system context (no cookies / user session).
 *
 * @param supabase - Supabase client (service-role or server-side)
 * @param invoiceId - Invoice UUID
 * @param recipientEmail - Destination email address
 * @param organizationId - Org UUID (for tracking + audit)
 */
export async function sendInvoiceEmailSystem(
  supabase: SupabaseClient,
  invoiceId: string,
  recipientEmail: string,
  organizationId: string
): Promise<{ error?: string }> {
  try {
    // 1. Fetch full invoice
    const invoice = await fetchInvoiceForEmail(supabase, invoiceId)
    if (!invoice) return { error: "Invoice not found" }

    // 2. Generate PAY by square QR code if IBAN is available
    let qrDataUrl: string | undefined
    const iban = invoice.bank_iban || invoice.supplier_iban
    if (iban) {
      try {
        const payData = encodePayBySquare({
          amount: Number(invoice.total),
          currencyCode: invoice.currency || "EUR",
          iban,
          variableSymbol: invoice.variable_symbol ?? undefined,
          constantSymbol: invoice.constant_symbol ?? undefined,
          specificSymbol: invoice.specific_symbol ?? undefined,
          beneficiaryName: invoice.supplier_name ?? undefined,
          dueDate: invoice.due_date
            ? invoice.due_date.replace(/-/g, "")
            : undefined,
        })
        qrDataUrl = await QRCode.toDataURL(payData, { width: 150, margin: 1 })
      } catch (qrErr) {
        console.error("[invoice-email-service] QR code generation failed:", qrErr)
        // Continue without QR code
      }
    }

    // 3. Generate PDF buffer with template settings
    const orgData = invoice.organization as { logo_url: string | null; invoice_template_settings?: Record<string, unknown> } | undefined
    const templateSettings: InvoiceTemplateSettings = orgData?.invoice_template_settings
      ? { ...DEFAULT_TEMPLATE_SETTINGS, ...orgData.invoice_template_settings } as InvoiceTemplateSettings
      : DEFAULT_TEMPLATE_SETTINGS

    const element = createElement(InvoicePdfDocument, { invoice, qrDataUrl, templateSettings })
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pdfBuffer = await renderToBuffer(element as any)

    // 4. Create email tracking record
    const subject = `Invoice ${invoice.invoice_number}`
    const tracking = await createTracking(supabase, organizationId, invoiceId, recipientEmail, subject)
    const trackingPixelHtml = tracking
      ? getTrackingPixelHtml(tracking.trackingPixelId)
      : ""

    // 5. Build HTML email body
    const html = `<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Invoice ${invoice.invoice_number}</h2>
  <table>
    <tr><td>From:</td><td>${invoice.supplier_name}</td></tr>
    <tr><td>To:</td><td>${invoice.customer_name}</td></tr>
    <tr><td>Issue Date:</td><td>${invoice.issue_date}</td></tr>
    <tr><td>Due Date:</td><td>${invoice.due_date}</td></tr>
    <tr><td>Total:</td><td>${invoice.total} ${invoice.currency ?? "EUR"}</td></tr>
  </table>
  <h3>Payment Details</h3>
  <p>IBAN: ${invoice.bank_iban ?? invoice.supplier_iban ?? "N/A"}<br>Variable Symbol: ${invoice.variable_symbol ?? "N/A"}</p>
  <p>The full invoice is attached as PDF.</p>
  ${trackingPixelHtml}
</div>`

    // 6. Send via Resend with PDF attachment
    const { data: emailResult, error: emailError } = await getResend().emails.send({
      from: "VEXERA <noreply@vexera.sk>",
      to: recipientEmail,
      subject,
      html,
      attachments: [
        {
          filename: `invoice-${invoice.invoice_number}.pdf`,
          content: Buffer.from(pdfBuffer).toString("base64"),
        },
      ],
    })

    if (emailError) {
      console.error("[invoice-email-service] Resend error:", emailError.message)
      return { error: `Failed to send email: ${emailError.message}` }
    }

    // 7. Update tracking record with Resend email ID
    if (tracking && emailResult?.id) {
      await supabase.from("email_tracking")
        .update({ resend_id: emailResult.id })
        .eq("id", tracking.trackingId)
    }

    // 8. Create audit log entry (system-initiated, no user_id)
    await supabase.from("audit_logs").insert({
      organization_id: organizationId,
      user_id: null,
      action: "INVOICE_EMAIL_SENT",
      entity_type: "invoice",
      entity_id: invoiceId,
      new_data: {
        recipient_email: recipientEmail,
        resend_id: emailResult?.id ?? null,
        source: "recurring_auto_send",
      },
    })

    console.log(`[invoice-email-service] Sent invoice ${invoiceId} to ${recipientEmail}`)
    return {}
  } catch (err) {
    console.error("[invoice-email-service] Unexpected error:", err)
    return { error: err instanceof Error ? err.message : "Unexpected error" }
  }
}
