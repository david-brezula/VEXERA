# Sprint 6: PDF Generation & E-Invoicing — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete invoice email sending with PDF attachment, add logo + QR to PDF, Peppol UBL export, recurring invoice cron, e-invoice import, Resend webhooks, and PDF template customization.

**Architecture:** Existing infrastructure (Resend, email tracking, recurring invoice service, queue, PDF renderer) gets wired together. New XML parsers/generators as pure functions. Template settings as JSONB on organizations.

**Tech Stack:** Next.js 15, Supabase, Resend, @react-pdf/renderer, qrcode, TypeScript

---

## Context for All Tasks

**Codebase:** `c:/Users/david/Documents/NW/Claude setup/VEXERA`

**Key patterns:**
- Server actions: `"use server"`, `createClient()` from `@/lib/supabase/server`, `getActiveOrgId()` from `@/lib/data/org`
- Client components: `"use client"`, `useSupabase()`, `useOrganization()`, `useQuery()`
- `as any` casts for tables not in generated types
- Install packages: `npx pnpm add`
- Type-check: `cd apps/web && npx pnpm tsc --noEmit`
- Build: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA" && npx pnpm build`

**Existing infrastructure:**
- `@react-pdf/renderer` installed, `InvoicePdfDocument` component at `apps/web/src/components/invoices/invoice-pdf.tsx`
- PDF API route at `apps/web/src/app/api/invoices/[id]/pdf/route.ts` using `renderToBuffer`
- `send-email-dialog.tsx` at `apps/web/src/components/invoices/send-email-dialog.tsx` — UI exists
- `sendInvoiceEmailAction` stub in `apps/web/src/lib/actions/invoices.ts` — creates email_tracking row but doesn't send
- Email tracking service at `apps/web/src/lib/services/email-tracking.service.ts` — fully implemented
- Resend already installed (from Sprint 4), utility at `apps/web/src/lib/email/send-invitation.ts`
- PAY by square encoder at `apps/web/src/lib/pay-by-square.ts` (server-side, uses zlib)
- `qrcode` package installed
- Recurring invoice service at `apps/web/src/lib/services/recurring-invoice.service.ts` — `processRecurringInvoices()` exists
- Queue service at `apps/web/src/lib/services/queue.service.ts` — infrastructure ready
- Queue processor at `apps/web/src/app/api/queue/process/route.ts` — no handlers registered
- Invoice data fetcher: `getInvoice()` in `apps/web/src/lib/data/invoices.ts`
- XML export actions already exist at `apps/web/src/lib/actions/xml-export.ts` (KV DPH, DP DPH, DP Type B from Sprint 5)

---

## Phase A: Invoice Email Sending

### Task 1: Wire Up sendInvoiceEmailAction

**Files:**
- Modify: `apps/web/src/lib/actions/invoices.ts`

**Step 1: Read existing files**

Read these to understand current state:
- `apps/web/src/lib/actions/invoices.ts` — find `sendInvoiceEmailAction`, understand the stub
- `apps/web/src/app/api/invoices/[id]/pdf/route.ts` — understand how PDF is generated
- `apps/web/src/lib/services/email-tracking.service.ts` — understand tracking API
- `apps/web/src/lib/email/send-invitation.ts` — understand Resend usage pattern
- `apps/web/src/components/invoices/invoice-pdf.tsx` — the PDF document component

**Step 2: Rewrite sendInvoiceEmailAction**

Replace the stub with a full implementation:

```typescript
export async function sendInvoiceEmailAction(invoiceId: string, recipientEmail: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // 1. Fetch invoice (same query pattern as PDF route)
  // Use getInvoice() or inline query with full joins (items, organization)

  // 2. Generate PDF buffer
  // import { renderToBuffer } from "@react-pdf/renderer"
  // import { createElement } from "react"
  // import { InvoicePdfDocument } from "@/components/invoices/invoice-pdf"
  // const pdfBuffer = await renderToBuffer(createElement(InvoicePdfDocument, { invoice }))

  // 3. Create email tracking record
  // import { createTracking, getTrackingPixelHtml } from "@/lib/services/email-tracking.service"
  // const tracking = await createTracking(supabase, { invoice_id: invoiceId, organization_id: invoice.organization_id, recipient_email: recipientEmail, sent_by: user.id })

  // 4. Build HTML email body
  // Inline summary: invoice number, dates, supplier→customer, total, payment details, tracking pixel

  // 5. Send via Resend with PDF attachment
  // import { Resend } from "resend"
  // const resend = new Resend(process.env.RESEND_API_KEY)
  // resend.emails.send({ from, to, subject, html, attachments: [{ filename, content: pdfBuffer.toString("base64") }] })

  // 6. Update tracking status to 'sent'

  revalidatePath(`/invoices/${invoiceId}`)
  return { success: true }
}
```

The HTML email body template:
```html
<div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
  <h2>Invoice {invoice_number}</h2>
  <table>
    <tr><td>From:</td><td>{supplier_name}</td></tr>
    <tr><td>To:</td><td>{customer_name}</td></tr>
    <tr><td>Issue Date:</td><td>{issue_date}</td></tr>
    <tr><td>Due Date:</td><td>{due_date}</td></tr>
    <tr><td>Total:</td><td>{total} EUR</td></tr>
  </table>
  <h3>Payment Details</h3>
  <p>IBAN: {iban}<br>Variable Symbol: {variable_symbol}</p>
  <p>The full invoice is attached as PDF.</p>
  <img src="{tracking_pixel_url}" width="1" height="1" />
</div>
```

**Step 3: Commit**
```
feat(email): wire up invoice email sending with PDF attachment
```

---

## Phase B: PDF Polish

### Task 2: Add Logo and QR Code to Invoice PDF

**Files:**
- Modify: `apps/web/src/components/invoices/invoice-pdf.tsx`
- Modify: `apps/web/src/app/api/invoices/[id]/pdf/route.ts` (if needed for data)

**Step 1: Read existing files**

- `apps/web/src/components/invoices/invoice-pdf.tsx` — current PDF layout
- `apps/web/src/lib/pay-by-square.ts` — PAY by square encoder
- `apps/web/src/lib/data/invoices.ts` — check if organization.logo_url is included in getInvoice query

**Step 2: Add company logo to PDF header**

In `InvoicePdfDocument`, at the top of the header section:
- If `invoice.organization?.logo_url` exists, render `<Image src={logo_url} style={{ width: 80, height: 80 }} />`
- Position it to the left of the company name
- `@react-pdf/renderer`'s Image component accepts URL strings

**Step 3: Add QR payment code to PDF footer**

For issued invoices with IBAN:
- The PDF component receives invoice data. Since `renderToBuffer` runs server-side, we can use Node.js APIs.
- Import `encodePayBySquare` from `@/lib/pay-by-square` and `QRCode` from `qrcode`
- Before rendering, compute: `const payBySquareData = encodePayBySquare({ iban, amount, variableSymbol, ... })`
- Generate QR as data URL: `const qrDataUrl = await QRCode.toDataURL(payBySquareData, { width: 150 })`
- Pass `qrDataUrl` as prop to the document, render `<Image src={qrDataUrl} />` in the footer section
- NOTE: Since the QR generation is async, the data URL must be computed BEFORE calling `renderToBuffer`. Modify the PDF route and email action to compute QR first, then pass it as a prop.

**Step 4: Commit**
```
feat(pdf): add company logo and PAY by square QR code to invoice PDF
```

---

## Phase C: Peppol UBL Export

### Task 3: Peppol UBL 2.1 XML Generator

**Files:**
- Create: `apps/web/src/lib/services/xml/peppol-ubl.ts`
- Modify: `apps/web/src/lib/actions/xml-export.ts`

**Step 1: Create UBL generator**

`apps/web/src/lib/services/xml/peppol-ubl.ts`:

Pure function that generates UBL 2.1 Invoice XML. Structure:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2"
         xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2"
         xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:cen.eu:en16931:2017#compliant#urn:fdc:peppol.eu:2017:poacc:billing:3.0</cbc:CustomizationID>
  <cbc:ProfileID>urn:fdc:peppol.eu:2017:poacc:billing:01:1.0</cbc:ProfileID>
  <cbc:ID>{invoice_number}</cbc:ID>
  <cbc:IssueDate>{issue_date}</cbc:IssueDate>
  <cbc:DueDate>{due_date}</cbc:DueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:Note>{notes}</cbc:Note>
  <cbc:DocumentCurrencyCode>EUR</cbc:DocumentCurrencyCode>
  <cac:AccountingSupplierParty>
    <cac:Party>
      <cac:PartyName><cbc:Name>{supplier_name}</cbc:Name></cac:PartyName>
      <cac:PostalAddress>
        <cbc:StreetName>{supplier_street}</cbc:StreetName>
        <cbc:CityName>{supplier_city}</cbc:CityName>
        <cbc:PostalZone>{supplier_zip}</cbc:PostalZone>
        <cac:Country><cbc:IdentificationCode>SK</cbc:IdentificationCode></cac:Country>
      </cac:PostalAddress>
      <cac:PartyTaxScheme>
        <cbc:CompanyID>{supplier_ic_dph}</cbc:CompanyID>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:PartyTaxScheme>
      <cac:PartyLegalEntity>
        <cbc:RegistrationName>{supplier_name}</cbc:RegistrationName>
        <cbc:CompanyID>{supplier_ico}</cbc:CompanyID>
      </cac:PartyLegalEntity>
    </cac:Party>
  </cac:AccountingSupplierParty>
  <!-- AccountingCustomerParty: same structure -->
  <cac:PaymentMeans>
    <cbc:PaymentMeansCode>30</cbc:PaymentMeansCode>
    <cbc:PaymentID>{variable_symbol}</cbc:PaymentID>
    <cac:PayeeFinancialAccount>
      <cbc:ID>{iban}</cbc:ID>
    </cac:PayeeFinancialAccount>
  </cac:PaymentMeans>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="EUR">{total_vat}</cbc:TaxAmount>
    <!-- TaxSubtotal per rate -->
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="EUR">{net_total}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="EUR">{net_total}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="EUR">{gross_total}</cbc:TaxInclusiveAmount>
    <cbc:PayableAmount currencyID="EUR">{gross_total}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <!-- InvoiceLine per item -->
  <cac:InvoiceLine>
    <cbc:ID>{line_number}</cbc:ID>
    <cbc:InvoicedQuantity unitCode="{unit}">{quantity}</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="EUR">{line_net}</cbc:LineExtensionAmount>
    <cac:Item>
      <cbc:Name>{description}</cbc:Name>
      <cac:ClassifiedTaxCategory>
        <cbc:ID>S</cbc:ID>
        <cbc:Percent>{vat_rate}</cbc:Percent>
        <cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme>
      </cac:ClassifiedTaxCategory>
    </cac:Item>
    <cac:Price>
      <cbc:PriceAmount currencyID="EUR">{unit_price}</cbc:PriceAmount>
    </cac:Price>
  </cac:InvoiceLine>
</Invoice>
```

Interface:
```typescript
interface UblInvoiceInput {
  invoice: {
    invoice_number: string; issue_date: string; due_date: string; notes?: string
    total_amount: number; vat_amount: number
    supplier_name: string; supplier_ico?: string; supplier_ic_dph?: string
    supplier_street?: string; supplier_city?: string; supplier_zip?: string
    customer_name: string; customer_ico?: string; customer_ic_dph?: string
    customer_street?: string; customer_city?: string; customer_zip?: string
    bank_iban?: string; variable_symbol?: string
    items: { description: string; quantity: number; unit: string; unit_price: number; vat_rate: number; vat_amount: number; total_price: number }[]
  }
}

export function generateUblInvoiceXml(input: UblInvoiceInput): string
```

**Step 2: Add export action**

Add `exportPeppolUblAction(invoiceId)` to `xml-export.ts`:
- Fetch invoice with items join
- Call `generateUblInvoiceXml()`
- Return `{ xml, filename }`

**Step 3: Add "Export UBL" button to invoice detail page**

Read `apps/web/src/app/(dashboard)/invoices/[id]/page.tsx` and add an "Export UBL" button next to the existing PDF download button.

**Step 4: Commit**
```
feat(peppol): add UBL 2.1 invoice XML export
```

---

## Phase D: Recurring Invoice Cron

### Task 4: Recurring Invoice Cron Endpoint + Queue Handler

**Files:**
- Create: `apps/web/src/app/api/cron/recurring/route.ts`
- Modify: `apps/web/src/app/api/queue/process/route.ts`
- Modify: `apps/web/src/lib/actions/invoices.ts` (for auto-send)

**Step 1: Read existing files**

- `apps/web/src/lib/services/recurring-invoice.service.ts` — `processRecurringInvoices()` signature
- `apps/web/src/app/api/queue/process/route.ts` — current handler registration
- `apps/web/src/lib/services/queue.service.ts` — queue API

**Step 2: Create cron endpoint**

`apps/web/src/app/api/cron/recurring/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { processRecurringInvoices } from "@/lib/services/recurring-invoice.service"

export async function POST(req: NextRequest) {
  // Validate CRON_SECRET
  const authHeader = req.headers.get("authorization")
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const supabase = await createClient()
  const result = await processRecurringInvoices(supabase)

  // For each generated invoice with auto_send, call sendInvoiceEmailAction
  // ...

  return NextResponse.json({ generated: result.length })
}
```

**Step 3: Register recurring_invoice handler in queue processor**

In the queue processor route, add the handler for `recurring_invoice` job type.

**Step 4: Add auto-send logic**

After `processRecurringInvoices()` generates invoices, for each template with `auto_send = true` and `send_to_email`, call `sendInvoiceEmailAction(invoiceId, sendToEmail)`.

**Step 5: Commit**
```
feat(recurring): add cron endpoint and auto-send for recurring invoices
```

---

## Phase E: E-Invoice Import

### Task 5: UBL 2.1 Parser

**Files:**
- Create: `apps/web/src/lib/services/xml/parse-ubl.ts`

**Step 1: Create UBL parser**

Parse UBL 2.1 Invoice XML and extract structured data:

```typescript
interface ParsedInvoice {
  invoiceNumber: string
  issueDate: string
  dueDate: string
  notes?: string
  currency: string
  supplierName: string; supplierIco?: string; supplierIcDph?: string
  supplierStreet?: string; supplierCity?: string; supplierZip?: string
  customerName: string; customerIco?: string; customerIcDph?: string
  customerStreet?: string; customerCity?: string; customerZip?: string
  iban?: string; variableSymbol?: string
  totalAmount: number; vatAmount: number
  items: { description: string; quantity: number; unit: string; unitPrice: number; vatRate: number; vatAmount: number; totalPrice: number }[]
}

export function parseUblInvoiceXml(xml: string): ParsedInvoice
```

Use simple XML parsing — extract values using regex or a lightweight XML parser. Since this runs server-side, you can use Node.js built-in modules. For simplicity, use regex-based extraction (the UBL structure is predictable).

**Step 2: Commit**
```
feat(einvoice): add UBL 2.1 invoice XML parser
```

---

### Task 6: CII Parser

**Files:**
- Create: `apps/web/src/lib/services/xml/parse-cii.ts`

**Step 1: Create CII (Cross Industry Invoice) parser**

Same `ParsedInvoice` output interface. CII uses different element names:
- `rsm:CrossIndustryInvoice` root
- `ram:ExchangedDocument` for invoice number/date
- `ram:SellerTradeParty` / `ram:BuyerTradeParty` for parties
- `ram:IncludedSupplyChainTradeLineItem` for line items

```typescript
export function parseCiiInvoiceXml(xml: string): ParsedInvoice
```

**Step 2: Commit**
```
feat(einvoice): add CII (Cross Industry Invoice) XML parser
```

---

### Task 7: E-Invoice Import Action + UI

**Files:**
- Create: `apps/web/src/lib/actions/e-invoice.ts`
- Create: `apps/web/src/components/invoices/import-einvoice-dialog.tsx`
- Modify: `apps/web/src/app/(dashboard)/invoices/page.tsx` (add Import button)

**Step 1: Create import action**

`apps/web/src/lib/actions/e-invoice.ts`:

```typescript
"use server"

export async function importEInvoiceAction(xmlContent: string) {
  // 1. Detect format (UBL or CII) by checking root element
  // 2. Parse using appropriate parser
  // 3. Match supplier against contacts (by ic_dph or ico)
  //    - If found: use contact_id
  //    - If not found: create new contact
  // 4. Create received invoice with all fields
  // 5. Create invoice items
  // 6. Return { invoiceId }
}
```

**Step 2: Create import dialog**

File upload dialog with drag-and-drop for .xml files:
- Read file content as text
- Call `importEInvoiceAction(xmlContent)`
- On success: redirect to `/invoices/${invoiceId}`
- On error: show error toast

**Step 3: Add "Import E-Invoice" button to invoices list page**

Read `apps/web/src/app/(dashboard)/invoices/page.tsx`, add the import button next to existing "New Invoice" button.

**Step 4: Commit**
```
feat(einvoice): add e-invoice import UI with UBL/CII auto-detection
```

---

## Phase F: Email Webhooks

### Task 8: Resend Webhook Endpoint

**Files:**
- Create: `apps/web/src/app/api/webhooks/resend/route.ts`

**Step 1: Create webhook handler**

```typescript
import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"

export async function POST(req: NextRequest) {
  // 1. Validate webhook signature
  const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
  // Resend sends svix-id, svix-timestamp, svix-signature headers
  // For simplicity: verify svix-signature using the webhook secret
  // Or just validate the body structure for now

  const body = await req.json()
  const { type, data } = body

  const supabase = await createClient()

  // Map Resend event types to email_tracking status
  // data.email_id or data.to[0] can be used to find tracking record
  // The tracking record stores the recipient email

  switch (type) {
    case "email.sent":
      // Update status to 'sent'
      break
    case "email.delivered":
      // Update status to 'delivered'
      break
    case "email.bounced":
    case "email.delivery_delayed":
      // Update status to 'failed'
      break
    case "email.complained":
      // Update status to 'failed'
      break
  }

  return NextResponse.json({ received: true })
}
```

NOTE: To link Resend events to email_tracking records, we need a way to correlate. Options:
- Store Resend's email ID (`data.email_id` from send response) in email_tracking when sending
- Or match by recipient email + timestamp

Best approach: When sending in Task 1, save Resend's returned `id` in email_tracking (add a `resend_id` column or store in metadata). Then webhook can look up by that ID.

**Step 2: If needed, add `resend_id` column to email_tracking**

Create migration if the table doesn't have a field for this. Or use an existing metadata/notes field.

**Step 3: Commit**
```
feat(email): add Resend webhook endpoint for delivery tracking
```

---

## Phase G: PDF Template Customization

### Task 9: Migration — Add Template Settings to Organizations

**Files:**
- Create: `supabase/migrations/20240101000050_invoice_template_settings.sql`

**Step 1: Write migration**

```sql
ALTER TABLE organizations ADD COLUMN invoice_template_settings JSONB
  NOT NULL DEFAULT '{
    "logoPosition": "left",
    "accentColor": "#111111",
    "font": "default",
    "footerText": "",
    "showBankDetails": true,
    "showQrCode": true,
    "showNotes": true,
    "showSignatureLines": true,
    "headerLayout": "side-by-side"
  }'::jsonb;
```

**Step 2: Commit**
```
feat(db): add invoice_template_settings to organizations
```

---

### Task 10: Invoice Template Settings Page

**Files:**
- Create: `apps/web/src/app/(dashboard)/settings/invoice-template/page.tsx`
- Create: `apps/web/src/lib/actions/invoice-template.ts`

**Step 1: Create server actions**

```typescript
"use server"

export async function getInvoiceTemplateSettingsAction() {
  // Fetch org's invoice_template_settings JSONB
}

export async function updateInvoiceTemplateSettingsAction(settings: InvoiceTemplateSettings) {
  // Update org's invoice_template_settings
}
```

**Step 2: Create settings page**

`/settings/invoice-template` page with:
- Color picker input for accent color
- Radio buttons for logo position (left/center/right)
- Select for font (Default, Serif, Modern)
- Textarea for footer text
- Toggle switches for: show bank details, show QR code, show notes, show signature lines
- Radio for header layout (side-by-side / stacked)
- Save button
- Live preview: a small Card showing a miniature invoice mockup that updates as settings change (simplified representation, not full PDF)

**Step 3: Add link in settings navigation**

If there's a settings sidebar/tabs, add "Invoice Template" link.

**Step 4: Commit**
```
feat(settings): add invoice template customization page
```

---

### Task 11: Apply Template Settings to PDF

**Files:**
- Modify: `apps/web/src/components/invoices/invoice-pdf.tsx`
- Modify: `apps/web/src/app/api/invoices/[id]/pdf/route.ts`

**Step 1: Read template settings in PDF route**

When generating PDF, fetch the org's `invoice_template_settings` and pass to `InvoicePdfDocument` as a prop.

**Step 2: Apply settings in PDF component**

- `accentColor`: apply to header background, table header, dividers
- `logoPosition`: style the logo Image with appropriate alignment
- `font`: register and use different font families (Helvetica=default, Times=serif, Roboto=modern — note @react-pdf/renderer has limited font support, use built-in fonts)
- `footerText`: render below notes section
- `showBankDetails`, `showQrCode`, `showNotes`, `showSignatureLines`: conditionally render sections
- `headerLayout`: change flex direction of header (row vs column)

**Step 3: Commit**
```
feat(pdf): apply organization template settings to invoice PDF
```

---

## Phase H: Verification

### Task 12: Type-Check and Build

**Step 1: Run type-check**
```bash
cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx pnpm tsc --noEmit
```

**Step 2: Run build**
```bash
cd "c:/Users/david/Documents/NW/Claude setup/VEXERA" && npx pnpm build
```

**Step 3: Fix any errors and commit**
```
fix: resolve type-check and build errors for sprint 6
```

---

## Summary

| Phase | Tasks | What |
|-------|-------|------|
| A | 1 | Invoice email sending with PDF attachment + inline summary |
| B | 2 | PDF polish — logo + QR payment code |
| C | 3 | Peppol UBL 2.1 XML export + button |
| D | 4 | Recurring invoice cron endpoint + auto-send |
| E | 5-7 | E-invoice import — UBL parser, CII parser, import action + UI |
| F | 8 | Resend webhook for delivery tracking |
| G | 9-11 | PDF template customization — migration, settings page, PDF integration |
| H | 12 | Type-check + build verification |
