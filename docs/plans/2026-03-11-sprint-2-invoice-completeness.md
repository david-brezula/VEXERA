# Sprint 2: Invoice Completeness — Implementation Plan

> **Design doc:** `docs/plans/2026-03-11-sprint-2-invoice-completeness-design.md`
> **Branch:** `feat/role-based-onboarding` (continues Sprint 1)

## Batches

Work is split into 4 sequential batches (Phases A → B → C → D).
Each batch ends with `npx pnpm type-check` and `npx pnpm build` verification.

---

## Batch 1 — Phase A: Database & Schema (Tasks 1–4)

### Task 1: Database migration — Add FK columns

**Create:** `supabase/migrations/20240101000044_invoice_contact_product_fk.sql`

```sql
-- Add contact_id FK to invoices (optional — snapshot fields remain)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Add product_id FK to invoice_items (optional — snapshot fields remain)
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- Add credit note FK to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS credit_note_for_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Update invoice_type check to include credit_note
ALTER TABLE public.invoices
  DROP CONSTRAINT invoices_invoice_type_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_invoice_type_check
  CHECK (invoice_type IN ('issued', 'received', 'credit_note'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON public.invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON public.invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_invoices_credit_note_for_id ON public.invoices(credit_note_for_id);
```

**Commit:** `feat(db): add contact_id, product_id, credit_note_for_id FK columns`

---

### Task 2: Add specific_symbol input to invoice form

**Modify:** `apps/web/src/components/invoices/invoice-form.tsx`

After the `constant_symbol` FormField (line 371), before the closing `</div>` of the payment grid, insert:

```tsx
            <FormField
              control={form.control}
              name="specific_symbol"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Specific symbol</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional" {...field} />
                  </FormControl>
                </FormItem>
              )}
            />
```

The field already exists in the Zod schema (line 58) and DB but was missing from the form.

**Commit:** `feat(form): add specific_symbol input to invoice form`

---

### Task 3: Cross-field date validation

**Modify:** `apps/web/src/lib/validations/invoice.schema.ts`

Add `.refine()` to `invoiceSchema` (after the closing `})`):

```typescript
export const invoiceSchema = z.object({
  // ... all existing fields unchanged ...
}).refine(
  (data) => {
    if (!data.issue_date || !data.due_date) return true
    return data.due_date >= data.issue_date
  },
  {
    message: "Due date must be on or after the issue date",
    path: ["due_date"],
  }
)
```

**Commit:** `feat(validation): add cross-field due_date >= issue_date check`

---

### Task 4: Add contact_id and product_id to schema + types

**Modify:** `apps/web/src/lib/validations/invoice.schema.ts`

Add to `invoiceItemSchema` (after `sort_order` at line 21):
```typescript
  product_id: z.string().uuid().optional().or(z.literal("")),
```

Add to `invoiceSchema` object (after `currency` at line 65):
```typescript
  contact_id: z.string().uuid().optional().or(z.literal("")),
```

Add `product_id: ""` to the default item in `defaultInvoiceValues` (line 113), and `contact_id: ""` to the return object (after `currency` at line 105).

**Modify:** `packages/types/src/index.ts`

Update `InvoiceType`:
```typescript
export type InvoiceType = 'issued' | 'received' | 'credit_note'
```

**Modify:** `apps/web/src/lib/actions/invoices.ts`

In `buildItemsPayload` (line 42-52), add after `sort_order: i`:
```typescript
      product_id: item.product_id || null,
```

In `createInvoiceAction` insert block (around line 87), add:
```typescript
        contact_id: values.contact_id || null,
```

**Commit:** `feat(schema): add contact_id, product_id fields and credit_note type`

### Batch 1 verification
```bash
cd "C:\Users\david\Documents\NW\Claude setup\VEXERA" && npx pnpm type-check && npx pnpm build
```

---

## Batch 2 — Phase B: Form Integration (Tasks 5–6)

### Task 5: ContactPicker combobox

**Pre-requisite:** Add shadcn Command component:
```bash
cd "C:\Users\david\Documents\NW\Claude setup\VEXERA\apps\web" && npx shadcn@latest add command
```

**Create:** `apps/web/src/lib/actions/contacts.ts`

Server action to search contacts:
```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { listContacts, type Contact } from "@/lib/services/contacts.service"

export async function searchContactsAction(
  search: string,
  type: "client" | "supplier"
): Promise<Contact[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []
  return listContacts(supabase, orgId, { type, search }, 20)
}
```

**Create:** `apps/web/src/components/invoices/contact-picker.tsx`

Combobox component using `Popover` + `Command` (cmdk):
- Props: `contactType: "supplier" | "client"`, `value?: string`, `onSelect: (contact) => void`
- On open/search change: calls `searchContactsAction(search, contactType)`
- Renders contact name, IČO, and city in dropdown items
- On selection: calls `onSelect(contact)`, closes popover

**Modify:** `apps/web/src/components/invoices/invoice-form.tsx`

Add two `ContactPicker` instances:
1. In Section 2 (Supplier, around line 115), before the supplier_name field — with `contactType="supplier"`
2. In Section 3 (Customer, around line 195), before the customer_name field — with `contactType="client"`

On contact selection, auto-fill using `form.setValue()`:
- `supplier_name` / `customer_name` ← `contact.name`
- `supplier_ico` / `customer_ico` ← `contact.ico`
- `supplier_dic` / `customer_dic` ← `contact.dic`
- `supplier_ic_dph` / `customer_ic_dph` ← `contact.ic_dph`
- `supplier_address` / `customer_address` ← `[contact.street, contact.city, contact.postal_code].filter(Boolean).join(", ")`
- `supplier_iban` ← `contact.bank_account` (supplier only)
- `contact_id` ← `contact.id`

Manual override: user can still edit text fields after selection.

**Commit:** `feat(form): add ContactPicker with auto-fill for supplier/customer`

---

### Task 6: ProductPicker combobox

**Create:** `apps/web/src/lib/actions/products.ts`

Server action to list products:
```typescript
"use server"

import { createClient } from "@/lib/supabase/server"
import { getActiveOrgId } from "@/lib/data/org"
import { listProducts, type Product } from "@/lib/services/products.service"

export async function searchProductsAction(): Promise<Product[]> {
  const [supabase, orgId] = await Promise.all([createClient(), getActiveOrgId()])
  if (!orgId) return []
  return listProducts(supabase, orgId, true) // activeOnly
}
```

**Create:** `apps/web/src/components/invoices/product-picker.tsx`

Combobox component using `Popover` + `Command`:
- Props: `value?: string`, `onSelect: (product) => void`
- Fetches all active products on open, client-side filters by search
- Shows product name, unit price, VAT rate in dropdown
- On selection: calls `onSelect(product)`, closes popover

**Modify:** `apps/web/src/components/invoices/invoice-items-editor.tsx`

For each line item row, add a small `ProductPicker` button before the description input. On product selection, use the field array's `update()` to set:
- `description` ← `product.name`
- `unit` ← `product.unit`
- `unit_price_net` ← `product.unit_price_net`
- `vat_rate` ← `product.vat_rate` (must be 20, 10, 5, or 0)
- `product_id` ← `product.id`

Manual entry still possible — `product_id` stays empty for custom items.

**Commit:** `feat(form): add ProductPicker with auto-fill for line items`

### Batch 2 verification
```bash
cd "C:\Users\david\Documents\NW\Claude setup\VEXERA" && npx pnpm type-check && npx pnpm build
```

---

## Batch 3 — Phase C: Print & PDF (Tasks 7–10)

### Task 7: VAT breakdown by rate in print view

**Modify:** `apps/web/src/app/(dashboard)/invoices/[id]/print/page.tsx`

Replace the Totals section (lines 148-162) with a VAT breakdown:

1. Compute `vatMap: Map<rate, { net, vat }>` from `invoice.invoice_items`
2. If multiple rates exist, render a breakdown table (Rate | Net Amount | VAT Amount)
3. Show per-rate VAT lines and subtotal in the totals area
4. Grand total at bottom with bold styling

```tsx
{(() => {
  const items = invoice.invoice_items ?? []
  const vatMap = new Map<number, { net: number; vat: number }>()
  for (const item of items) {
    const rate = Number(item.vat_rate)
    const prev = vatMap.get(rate) ?? { net: 0, vat: 0 }
    prev.net += Number(item.quantity) * Number(item.unit_price)
    prev.vat += Number(item.vat_amount)
    vatMap.set(rate, prev)
  }
  const breakdown = Array.from(vatMap.entries()).sort((a, b) => b[0] - a[0])
  return (
    <div className="border-t border-gray-900 pt-4 ml-auto w-72 text-sm">
      {breakdown.length > 1 && (
        <table className="w-full mb-2">
          <thead><tr className="text-xs text-gray-500">
            <th className="text-left font-normal pb-1">VAT rate</th>
            <th className="text-right font-normal pb-1">Net amount</th>
            <th className="text-right font-normal pb-1">VAT</th>
          </tr></thead>
          <tbody>{breakdown.map(([rate, { net, vat }]) => (
            <tr key={rate} className="text-gray-600">
              <td className="py-0.5">{rate}%</td>
              <td className="py-0.5 text-right tabular-nums">{formatEur(net)}</td>
              <td className="py-0.5 text-right tabular-nums">{formatEur(vat)}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <div className="space-y-1">
        <div className="flex justify-between text-gray-500">
          <span>Subtotal (net)</span>
          <span className="tabular-nums">{formatEur(Number(invoice.subtotal))}</span>
        </div>
        {breakdown.map(([rate, { vat }]) => (
          <div key={rate} className="flex justify-between text-gray-500">
            <span>VAT {rate}%</span>
            <span className="tabular-nums">{formatEur(vat)}</span>
          </div>
        ))}
        <div className="flex justify-between text-base font-bold border-t border-gray-900 pt-2">
          <span>Total</span>
          <span className="tabular-nums">{formatEur(Number(invoice.total))}</span>
        </div>
      </div>
    </div>
  )
})()}
```

**Commit:** `feat(print): add VAT breakdown by rate in invoice print view`

---

### Task 8: Company logo in print view

**Note:** `organizations` table already has `logo_url TEXT` (line 16 of `000003`). No migration needed.

**Modify:** `apps/web/src/lib/data/invoices.ts`

Update `getInvoice` select to join organization logo:
```typescript
.select("*, invoice_items(*), organization:organizations!organization_id(logo_url)")
```

Update `InvoiceDetail` type:
```typescript
export type InvoiceDetail = Database["public"]["Tables"]["invoices"]["Row"] & {
  invoice_items: Database["public"]["Tables"]["invoice_items"]["Row"][]
  organization?: { logo_url: string | null } | null
}
```

**Modify:** `apps/web/src/app/(dashboard)/invoices/[id]/print/page.tsx`

In the header section (lines 24-28), add logo before the INVOICE title:
```tsx
<div className="flex items-center gap-4">
  {invoice.organization?.logo_url && (
    <img src={invoice.organization.logo_url} alt="Company logo"
      className="h-16 w-auto object-contain" />
  )}
  <div>
    <h1 className="text-3xl font-bold tracking-tight">INVOICE</h1>
    <p className="text-lg font-mono text-gray-500 mt-1">{invoice.invoice_number}</p>
  </div>
</div>
```

**Commit:** `feat(print): render company logo in invoice print header`

---

### Task 9: QR payment code (PAY by square)

**Install:**
```bash
cd "C:\Users\david\Documents\NW\Claude setup\VEXERA" && npx pnpm add qrcode lzma --filter @vexera/web && npx pnpm add -D @types/qrcode --filter @vexera/web
```

**Create:** `apps/web/src/lib/pay-by-square.ts`

PAY by square encoder:
1. Build tab-separated data string per spec (payment ID, count, type, amount, currency, due date, VS/KS/SS, ref, note, account count, IBAN, BIC, standing order, direct debit, beneficiary, address lines)
2. LZMA compress via `lzma` package
3. Prepend 2-byte big-endian uint16 of uncompressed length
4. Base32hex encode (RFC 4648, no padding, alphabet `0-9A-V`)
5. Prepend "0000" header (version + redundancy)

Export: `encodePayBySquare(input: PayBySquareInput): Promise<string>`

**Create:** `apps/web/src/components/invoices/qr-payment-code.tsx`

Client component (`"use client"`):
- Props: `amount, currency, iban, variableSymbol, constantSymbol, specificSymbol, dueDate, beneficiaryName, note`
- `useEffect` calls `encodePayBySquare()` then `QRCode.toString(encoded, { type: "svg", width: 160 })`
- Renders SVG via `dangerouslySetInnerHTML` with "PAY by square" label below
- Returns `null` if no IBAN or on error
- Shows skeleton while generating

**Modify:** `apps/web/src/app/(dashboard)/invoices/[id]/print/page.tsx`

After totals section, before notes, add QR code section (only for issued invoices with IBAN):
```tsx
{invoice.invoice_type === "issued" && invoice.supplier_iban && (
  <div className="mt-6 flex items-start gap-4">
    <QrPaymentCode
      amount={Number(invoice.total)} currency={invoice.currency || "EUR"}
      iban={invoice.supplier_iban} variableSymbol={invoice.variable_symbol ?? undefined}
      constantSymbol={invoice.constant_symbol ?? undefined}
      specificSymbol={invoice.specific_symbol ?? undefined}
      dueDate={invoice.due_date} beneficiaryName={invoice.supplier_name}
    />
    <div className="text-xs text-gray-500 space-y-0.5 pt-2">
      <p>Scan to pay via your banking app</p>
      <p className="font-mono">{invoice.supplier_iban}</p>
      {invoice.variable_symbol && <p>VS: {invoice.variable_symbol}</p>}
    </div>
  </div>
)}
```

**Commit:** `feat(print): add PAY by square QR payment code on invoice print`

---

### Task 10: PDF generation via @react-pdf/renderer

**Install:**
```bash
cd "C:\Users\david\Documents\NW\Claude setup\VEXERA" && npx pnpm add @react-pdf/renderer --filter @vexera/web
```

**Create:** `apps/web/src/components/invoices/invoice-pdf.tsx`

React PDF document component using `@react-pdf/renderer`:
- `Document > Page` with A4 size, padding 40, Helvetica font
- Mirrors the print layout: header (INVOICE + number), supplier/customer columns, dates row, line items table with alternating row colors, VAT breakdown, totals, notes, signature lines
- Uses `StyleSheet.create()` for all styling
- Helper: `fmtEur(n)` for currency, `fmtDate(iso)` for date formatting
- Export: `InvoicePdfDocument({ invoice: InvoiceDetail })`

**Create:** `apps/web/src/app/api/invoices/[id]/pdf/route.ts`

GET route handler:
```typescript
import { renderToBuffer } from "@react-pdf/renderer"
import { createElement } from "react"
import { getInvoice } from "@/lib/data/invoices"
import { InvoicePdfDocument } from "@/components/invoices/invoice-pdf"

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const invoice = await getInvoice(id)
  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const buffer = await renderToBuffer(createElement(InvoicePdfDocument, { invoice }))
  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  })
}
```

**Modify:** `apps/web/src/app/(dashboard)/invoices/[id]/page.tsx`

Add "PDF" download button next to the Print button:
```tsx
<Button variant="outline" size="sm" asChild>
  <a href={`/api/invoices/${id}/pdf`} download>
    <DownloadIcon className="size-4" /> PDF
  </a>
</Button>
```

Import `DownloadIcon` from lucide-react.

**Commit:** `feat(invoices): add PDF generation with @react-pdf/renderer`

### Batch 3 verification
```bash
cd "C:\Users\david\Documents\NW\Claude setup\VEXERA" && npx pnpm type-check && npx pnpm build
```

---

## Batch 4 — Phase D: Actions & Stats (Tasks 11–14)

### Task 11: Credit note creation

**Modify:** `apps/web/src/lib/actions/invoices.ts`

Add `createCreditNoteAction(originalInvoiceId: string)`:
1. Fetch original invoice with items, validate org ownership
2. Validate status is `sent` or `paid`
3. Generate invoice number with `generateInvoiceNumber(supabase, orgId, "credit_note")`
4. Insert new invoice: `invoice_type: "credit_note"`, `credit_note_for_id: originalInvoiceId`, `status: "draft"`, all snapshot fields copied from original, amounts negated (`-Math.abs(...)`)
5. Copy line items with negated `unit_price`, `vat_amount`, `total`
6. Create audit log with action `CREDIT_NOTE_CREATED`
7. Revalidate `/invoices` and original invoice path
8. Return `{ id }` of new credit note

**Modify:** `apps/web/src/components/invoices/invoice-actions.tsx`

- Import `createCreditNoteAction` and `ReceiptIcon` from lucide-react
- Add "Credit note" entry to `STATUS_ACTIONS` for `sent` and `paid` statuses
- Handle `credit_note` in `handleAction`: call `createCreditNoteAction`, navigate to new credit note on success

**Commit:** `feat(invoices): add credit note creation from sent/paid invoices`

---

### Task 12: Send invoice by email (stub + UI)

**Modify:** `apps/web/src/lib/actions/invoices.ts`

Add `sendInvoiceEmailAction(invoiceId: string, recipientEmail: string)`:
1. Validate invoice exists and belongs to org
2. Insert `email_tracking` row with `status: "pending"`
3. Create audit log with action `INVOICE_EMAIL_QUEUED`
4. TODO comment for actual PDF generation + transactional email sending
5. Return `{ error? }`

**Create:** `apps/web/src/components/invoices/send-email-dialog.tsx`

Dialog component:
- `Dialog` with `DialogTrigger` ("Send email" button with `MailIcon`)
- `DialogContent` with email input field and Send button
- On submit: calls `sendInvoiceEmailAction`, shows toast
- Uses `useTransition` for pending state

**Modify:** `apps/web/src/app/(dashboard)/invoices/[id]/page.tsx`

Add `SendEmailDialog` after the PDF button, conditionally shown for sent/paid invoices:
```tsx
{(invoice.status === "sent" || invoice.status === "paid") && (
  <SendEmailDialog invoiceId={id} invoiceNumber={invoice.invoice_number} />
)}
```

**Commit:** `feat(invoices): add send-by-email stub with dialog and tracking`

---

### Task 13: Wire contact stats on invoice creation

**Modify:** `apps/web/src/lib/actions/invoices.ts`

Add helper `updateContactStats(supabase, contactId, invoiceTotal)`:
- Fetch current `invoice_count` and `total_invoiced` from contacts table
- Increment count by 1, add `Math.abs(total)` to `total_invoiced`
- Wrapped in try/catch — non-critical, log errors but don't fail invoice creation

Call in `createInvoiceAction` after invoice creation when `values.contact_id` is present.

**Commit:** `feat(invoices): update contact stats on invoice creation`

---

### Task 14: Wire product stats on invoice creation

**Modify:** `apps/web/src/lib/actions/invoices.ts`

Add helper `updateProductStats(supabase, items)`:
- Group items by `product_id` (skip items without one)
- For each product: fetch current `times_invoiced` and `total_revenue`, increment
- Wrapped in try/catch — non-critical

Call in `createInvoiceAction` after invoice + items creation.

**Commit:** `feat(invoices): update product stats on invoice creation`

### Batch 4 verification
```bash
cd "C:\Users\david\Documents\NW\Claude setup\VEXERA" && npx pnpm type-check && npx pnpm build
```

---

## Summary

| Batch | Phase | Tasks | Key deliverables |
|-------|-------|-------|-----------------|
| 1 | A | 1–4 | Migration, specific_symbol field, date validation, schema updates |
| 2 | B | 5–6 | ContactPicker, ProductPicker comboboxes with auto-fill |
| 3 | C | 7–10 | VAT breakdown, logo, PAY by square QR, PDF generation |
| 4 | D | 11–14 | Credit notes, email sending stub, contact/product stats |

## New dependencies
- `@react-pdf/renderer` — PDF generation (Phase C)
- `qrcode` + `@types/qrcode` — QR code rendering (Phase C)
- `lzma` — LZMA compression for PAY by square (Phase C)
- `cmdk` — Command palette for pickers (Phase B, via `shadcn add command`)

## Files created (new)
- `supabase/migrations/20240101000044_invoice_contact_product_fk.sql`
- `apps/web/src/components/invoices/contact-picker.tsx`
- `apps/web/src/components/invoices/product-picker.tsx`
- `apps/web/src/lib/actions/contacts.ts`
- `apps/web/src/lib/actions/products.ts`
- `apps/web/src/lib/pay-by-square.ts`
- `apps/web/src/components/invoices/qr-payment-code.tsx`
- `apps/web/src/components/invoices/invoice-pdf.tsx`
- `apps/web/src/app/api/invoices/[id]/pdf/route.ts`
- `apps/web/src/components/invoices/send-email-dialog.tsx`

## Files modified
- `apps/web/src/lib/validations/invoice.schema.ts`
- `apps/web/src/components/invoices/invoice-form.tsx`
- `apps/web/src/components/invoices/invoice-items-editor.tsx`
- `apps/web/src/app/(dashboard)/invoices/[id]/print/page.tsx`
- `apps/web/src/lib/data/invoices.ts`
- `apps/web/src/lib/actions/invoices.ts`
- `apps/web/src/components/invoices/invoice-actions.tsx`
- `apps/web/src/app/(dashboard)/invoices/[id]/page.tsx`
- `packages/types/src/index.ts`
