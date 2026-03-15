# Sprint 6: PDF Generation & E-Invoicing — Design

## Decisions

- **Peppol:** UBL 2.1 XML export only (no Access Point connection)
- **Recurring invoices:** External cron trigger with documentation (not Vercel Cron)
- **Invoice email:** PDF attachment + inline HTML summary
- **E-invoice import:** Parse UBL 2.1 and CII XML into received invoices
- **Email webhooks:** Resend webhook for delivery status tracking
- **PDF templates:** JSONB column on organizations for customization settings

---

## 1. Invoice Email Sending (Complete the Stub)

Wire up `sendInvoiceEmailAction` in `apps/web/src/lib/actions/invoices.ts`:

1. Fetch invoice with full details (same query as PDF route)
2. Generate PDF via `renderToBuffer(createElement(InvoicePdfDocument, { invoice }))`
3. Create email tracking record via `createTracking()` from email-tracking service
4. Build HTML email body with inline summary:
   - Invoice number, issue date, due date
   - Supplier -> Customer
   - Total amount (EUR)
   - Payment details (IBAN, variable symbol)
   - Tracking pixel at bottom
5. Send via Resend with PDF as base64 attachment
6. Update email_tracking status to `sent`

Reuse existing `send-email-dialog.tsx` UI.

---

## 2. PDF Polish — Logo + QR Code

Add to `invoice-pdf.tsx`:

- **Company logo:** Render `organization.logo_url` in PDF header via `@react-pdf/renderer` Image component
- **QR payment code:** For issued invoices with IBAN:
  - Generate PAY by square data using existing `lib/pay-by-square.ts` (Node.js zlib, runs server-side in renderToBuffer)
  - Convert to QR code data URL via `qrcode.toDataURL()`
  - Render in PDF footer via Image component

---

## 3. Peppol UBL 2.1 XML Export

Generate Peppol-compliant UBL 2.1 Invoice XML for manual upload to Access Points.

- `apps/web/src/lib/services/xml/peppol-ubl.ts` — pure function `generateUblInvoiceXml(invoice)`
- Server action: `exportPeppolUblAction(invoiceId)` in `xml-export.ts`
- "Export UBL" button on invoice detail page

Maps VEXERA invoice fields to UBL: supplier/customer parties, line items with VAT, payment means, tax totals, monetary totals.

---

## 4. Recurring Invoice Job Handler + Cron

Wire up the queue processor:

1. Create `/api/cron/recurring` route:
   - Validates `CRON_SECRET` header
   - Calls `processRecurringInvoices()` directly
   - Returns JSON with count of invoices generated
2. Register `recurring_invoice` handler in queue processor
3. Auto-send: when template has `auto_send = true`, call `sendInvoiceEmailAction` after generation

Document: "Call POST /api/cron/recurring with Authorization: Bearer $CRON_SECRET every hour"

---

## 5. Incoming E-Invoice Parsing

Parse UBL 2.1 / CII XML into VEXERA invoices.

- "Import E-Invoice" button on invoices list page -> file upload dialog (.xml)
- `apps/web/src/lib/services/xml/parse-ubl.ts` — UBL 2.1 parser
- `apps/web/src/lib/services/xml/parse-cii.ts` — CII (Cross Industry Invoice) parser
- `apps/web/src/lib/actions/e-invoice.ts` — `importEInvoiceAction(xmlContent)`

Flow:
1. User uploads XML file
2. Parser extracts: supplier, customer, line items, VAT, dates, payment info
3. Creates `received` invoice with all fields populated
4. Matches supplier against existing contacts (by IC DPH or ICO), creates contact if new
5. Redirects to invoice detail for review

---

## 6. Email Delivery Webhooks

Resend webhook endpoint for real-time status updates.

- `apps/web/src/app/api/webhooks/resend/route.ts` — POST endpoint
- Validates webhook signature using `RESEND_WEBHOOK_SECRET` env var
- Handles: `email.sent`, `email.delivered`, `email.bounced`, `email.complained`
- Updates `email_tracking` table status accordingly
- User adds webhook URL in Resend dashboard

---

## 7. Invoice PDF Template Customization

JSONB column `invoice_template_settings` on organizations table.

Settings:
- Logo position (left/center/right)
- Accent color (hex)
- Font choice (default/serif/modern)
- Footer text (custom)
- Show/hide toggles: bank details, QR code, notes, signature lines
- Header layout: side-by-side vs stacked

Settings UI: `/settings/invoice-template` page with:
- Color picker, radio buttons, dropdowns, toggles
- Live preview panel

PDF integration: `InvoicePdfDocument` reads org template settings and applies dynamic styles.

---

## Not in Sprint 6

- Peppol Access Point connection (send/receive via network)
- Multiple invoice templates per org
- eDane direct submission API
