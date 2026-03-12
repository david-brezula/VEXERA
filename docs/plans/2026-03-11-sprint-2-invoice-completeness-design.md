# Sprint 2: Invoice Completeness — Design Document

## Problem

Invoicing is the core feature of VEXERA but has significant gaps that prevent production use: contacts and products are decoupled from invoices (no FK relationships), the print view lacks QR payment codes and VAT breakdown by rate, there's no PDF generation, no email sending, no credit notes, and several form fields are missing.

## Goals

Make invoicing production-ready and competitive with Slovak market leaders by completing all 12 gaps identified in the feature audit.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Contact ↔ Invoice link | Add optional `contact_id` FK, keep text fields as snapshot | Invoices freeze data at creation time; contacts can change later |
| Product ↔ Invoice Items link | Add optional `product_id` FK, keep text fields as snapshot | Same snapshot pattern |
| PDF generation | `@react-pdf/renderer` | No Chromium binary needed, React components, server-side |
| QR payment code | Full PAY by square standard | Slovak banking apps expect this format; EPC QR is insufficient |
| Credit notes | New invoice with `invoice_type: "credit_note"` + `credit_note_for_id` FK | Links back to original invoice, negative amounts |

## Architecture

### Phase A: Database & Schema

**Migration `20240101000044_invoice_contact_product_fk.sql`:**
- Add `contact_id UUID REFERENCES contacts(id) ON DELETE SET NULL` to `invoices`
- Add `product_id UUID REFERENCES products(id) ON DELETE SET NULL` to `invoice_items`
- Add `credit_note_for_id UUID REFERENCES invoices(id) ON DELETE SET NULL` to `invoices`
- Add index on `contact_id`, `product_id`, `credit_note_for_id`

**Schema updates (`invoice.schema.ts`):**
- Add `.refine()` cross-field validation: `due_date >= issue_date`
- Add optional `contact_id` field
- Add optional `product_id` on item schema

**Form fix:**
- Add `specific_symbol` input to Section 4 (Dates & Payment) — field exists in schema (line 58) and DB (line 31) but is not rendered in the form

### Phase B: Form Integration

**Contact autocomplete (invoice-form.tsx):**
- New `ContactPicker` component — combobox with search, queries `contacts.service.ts`
- On contact selection: auto-fills supplier/customer name, IČO, DIČ, IČ DPH, address, IBAN
- Sets hidden `contact_id` field
- Manual override still possible (user can edit text fields after selection)
- Separate pickers for supplier (type: supplier/both) and customer (type: client/both)

**Product picker (invoice-items-editor.tsx):**
- New `ProductPicker` component — combobox with search, queries `products.service.ts`
- On product selection: auto-fills description, unit, unit_price_net, vat_rate
- Sets hidden `product_id` on the line item
- Manual entry still possible (product_id stays null for custom items)

### Phase C: Print & PDF

**VAT breakdown by rate (print/page.tsx):**
- Group line items by `vat_rate`
- Show table: Rate | Net Amount | VAT Amount
- Replace single "VAT" total line with this breakdown

**Company logo:**
- Add `logo_url` column to `organizations` table (migration)
- Render `<img>` in print view header if logo_url is set
- Logo upload UI in org settings (S3 upload, stores URL)

**QR payment code (PAY by square):**
- Implement PAY by square encoder: structure → XZ compress → Base32 encode → prepend header
- Data: IBAN, amount, currency, variable symbol, constant symbol, specific symbol, due date, beneficiary name
- Render QR code using `qrcode` package as inline SVG/data URL
- Show on print view in payment section (only for issued invoices with IBAN)

**PDF generation:**
- New: `app/api/invoices/[id]/pdf/route.ts` — GET endpoint returning `application/pdf`
- New: `components/invoices/invoice-pdf.tsx` — React PDF document component (mirrors print layout)
- Uses `@react-pdf/renderer` `renderToStream()`
- "Download PDF" button on invoice detail page

### Phase D: Actions & Stats

**Credit note creation:**
- New action: `createCreditNoteAction(originalInvoiceId)`
- Creates new invoice with `invoice_type: "credit_note"`, `credit_note_for_id` set
- Copies all fields from original, negates line item amounts
- "Create credit note" button on invoice detail (only for paid/sent invoices)

**Send by email:**
- New action: `sendInvoiceEmailAction(invoiceId, recipientEmail?)`
- Generates PDF, sends via existing email infrastructure
- Creates `email_tracking` row with tracking pixel
- "Send by email" button on invoice detail (for sent status)

**Contact stats wiring:**
- On invoice creation: increment contact's `invoice_count`, add to `total_invoiced`
- On invoice payment: update contact's `avg_payment_days`

**Product stats wiring:**
- On invoice creation: for each line item with `product_id`, increment `times_invoiced`, add to `total_revenue`

## New Dependencies

| Package | Purpose | Phase |
|---------|---------|-------|
| `@react-pdf/renderer` | PDF generation | C |
| `qrcode` | QR code for PAY by square | C |

## Verification

After each phase:
1. `pnpm type-check` — zero errors
2. `pnpm build` — successful build
3. Manual test affected flows in browser
4. For migrations: verify on fresh `supabase db push`

## Key Files Reference

| Area | File |
|------|------|
| Invoice form | `apps/web/src/components/invoices/invoice-form.tsx` |
| Line items editor | `apps/web/src/components/invoices/invoice-items-editor.tsx` |
| Invoice schema | `apps/web/src/lib/validations/invoice.schema.ts` |
| Invoice actions (server) | `apps/web/src/lib/actions/invoices.ts` |
| Invoice actions (UI) | `apps/web/src/components/invoices/invoice-actions.tsx` |
| Print view | `apps/web/src/app/(dashboard)/invoices/[id]/print/page.tsx` |
| Contacts service | `apps/web/src/lib/services/contacts.service.ts` |
| Products service | `apps/web/src/lib/services/products.service.ts` |
| Invoices migration | `supabase/migrations/20240101000008_invoices.sql` |
| Invoice items migration | `supabase/migrations/20240101000009_invoice_items.sql` |
| Contacts migration | `supabase/migrations/20240101000038_contacts.sql` |
| Products migration | `supabase/migrations/20240101000039_products.sql` |
