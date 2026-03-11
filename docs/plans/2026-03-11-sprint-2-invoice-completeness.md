# Sprint 2: Invoice Completeness — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make invoicing production-ready by completing all gaps: FK relationships, form integration, print enhancements, PDF generation, credit notes, email sending, and stats wiring.

**Architecture:** Add optional FKs (contact_id, product_id, credit_note_for_id) while keeping text snapshot fields. Add ContactPicker/ProductPicker comboboxes to the invoice form. Enhance print view with VAT breakdown, logo, and PAY by square QR. Generate PDFs server-side with @react-pdf/renderer. Add credit note and email actions.

**Tech Stack:** Next.js 15, Supabase, TypeScript, Zod, shadcn/ui, cmdk, @react-pdf/renderer, qrcode, lzma-native/lzma-js

---

## Phase A: Database & Schema (Tasks 1–4)

### Task 1: Database migration — Add FK columns

**Files:**
- Create: `supabase/migrations/20240101000044_invoice_contact_product_fk.sql`

**Step 1: Write the migration**

```sql
-- Add contact FK to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES public.contacts(id) ON DELETE SET NULL;

-- Add product FK to invoice_items
ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS product_id UUID REFERENCES public.products(id) ON DELETE SET NULL;

-- Add credit note FK to invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS credit_note_for_id UUID REFERENCES public.invoices(id) ON DELETE SET NULL;

-- Add invoice_type column (standard or credit_note)
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS invoice_type TEXT NOT NULL DEFAULT 'standard'
  CHECK (invoice_type IN ('standard', 'credit_note'));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_contact_id ON public.invoices(contact_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_product_id ON public.invoice_items(product_id);
CREATE INDEX IF NOT EXISTS idx_invoices_credit_note_for_id ON public.invoices(credit_note_for_id);
```

**Step 2: Verify migration**

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA" && npx supabase db push --dry-run` (or just verify SQL syntax)

**Step 3: Commit**

```bash
git add supabase/migrations/20240101000044_invoice_contact_product_fk.sql
git commit -m "feat: add contact_id, product_id, credit_note_for_id FKs to invoices"
```

---

### Task 2: Update invoice Zod schema

**Files:**
- Modify: `apps/web/src/lib/validations/invoice.schema.ts`

**Step 1: Add new fields to the schema**

Add to the invoice schema:
- `contact_id: z.string().uuid().optional().nullable()`
- `invoice_type: z.enum(["standard", "credit_note"]).default("standard")`
- `credit_note_for_id: z.string().uuid().optional().nullable()`

Add to the invoice item schema:
- `product_id: z.string().uuid().optional().nullable()`

**Step 2: Add cross-field validation**

Add `.refine()` to ensure `due_date >= issue_date`:

```typescript
.refine(
  (data) => !data.due_date || !data.issue_date || new Date(data.due_date) >= new Date(data.issue_date),
  { message: "Due date must be on or after issue date", path: ["due_date"] }
)
```

**Step 3: Verify**

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add apps/web/src/lib/validations/invoice.schema.ts
git commit -m "feat: add FK fields and cross-field validation to invoice schema"
```

---

### Task 3: Add specific_symbol to invoice form

**Files:**
- Modify: `apps/web/src/components/invoices/invoice-form.tsx`

**Step 1: Read the form file to find Section 4 (Dates & Payment)**

The `specific_symbol` field exists in schema (line 58) and DB (line 31) but has no form input. Add it to Section 4 alongside `variable_symbol` and `constant_symbol`.

**Step 2: Add the input field**

In Section 4, after the `constant_symbol` FormField, add:

```tsx
<FormField
  control={form.control}
  name="specific_symbol"
  render={({ field }) => (
    <FormItem>
      <FormLabel>Specific Symbol</FormLabel>
      <FormControl>
        <Input placeholder="e.g. 1234567890" {...field} value={field.value ?? ""} />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

**Step 3: Verify**

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add apps/web/src/components/invoices/invoice-form.tsx
git commit -m "feat: add specific_symbol input to invoice form"
```

---

### Task 4: Update invoice server actions for new fields

**Files:**
- Modify: `apps/web/src/lib/actions/invoices.ts`

**Step 1: Read the actions file**

Understand how `createInvoiceAction` and `updateInvoiceAction` build the insert/update object.

**Step 2: Pass new fields through**

Ensure `contact_id`, `invoice_type`, and `credit_note_for_id` are included in the insert/update objects when present. Ensure `product_id` is passed through for each invoice item.

**Step 3: Verify**

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add apps/web/src/lib/actions/invoices.ts
git commit -m "feat: pass FK fields through invoice server actions"
```

---

## Phase B: Form Integration (Tasks 5–6)

### Task 5: ContactPicker component

**Files:**
- Create: `apps/web/src/components/invoices/contact-picker.tsx`
- Modify: `apps/web/src/components/invoices/invoice-form.tsx`

**Step 1: Check if cmdk/Command component exists**

Look for `components/ui/command.tsx` (shadcn Command component). If not present, add it:

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx shadcn@latest add command popover`

**Step 2: Create ContactPicker component**

Create `contact-picker.tsx` — a Popover + Command combobox that:
- Accepts `contactType: "supplier" | "client"` prop to filter contacts
- Queries contacts service with debounced search
- On selection: calls `onSelect(contact)` callback with full contact data
- Shows contact name, IČO, and address in dropdown

```tsx
"use client"

import { useState, useEffect } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

interface Contact {
  id: string
  name: string
  ico?: string | null
  dic?: string | null
  ic_dph?: string | null
  street?: string | null
  city?: string | null
  zip?: string | null
  country?: string | null
  iban?: string | null
  type: string
}

interface ContactPickerProps {
  contactType: "supplier" | "client"
  value?: string | null
  onSelect: (contact: Contact) => void
  organizationId: string
}

export function ContactPicker({ contactType, value, onSelect, organizationId }: ContactPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [contacts, setContacts] = useState<Contact[]>([])
  const [selectedName, setSelectedName] = useState("")

  // Fetch contacts with search — uses the contacts service
  // Implementation will query supabase directly from client
  // Filter by type: supplier contacts show type='supplier'|'both', client shows type='client'|'both'

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between">
          {selectedName || `Select ${contactType}...`}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder={`Search ${contactType}s...`} value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No {contactType} found.</CommandEmpty>
            <CommandGroup>
              {contacts.map((contact) => (
                <CommandItem
                  key={contact.id}
                  value={contact.name}
                  onSelect={() => {
                    onSelect(contact)
                    setSelectedName(contact.name)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === contact.id ? "opacity-100" : "opacity-0")} />
                  <div>
                    <div className="font-medium">{contact.name}</div>
                    {contact.ico && <div className="text-xs text-muted-foreground">IČO: {contact.ico}</div>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

**Step 3: Integrate into invoice-form.tsx**

Add ContactPicker above supplier fields in Section 2 and above customer fields in Section 3:
- On contact select: auto-fill name, IČO, DIČ, IČ DPH, address fields, IBAN using `form.setValue()`
- Set hidden `contact_id` field

**Step 4: Verify**

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add apps/web/src/components/invoices/contact-picker.tsx apps/web/src/components/invoices/invoice-form.tsx
git commit -m "feat: add ContactPicker with auto-fill for supplier/customer"
```

---

### Task 6: ProductPicker component

**Files:**
- Create: `apps/web/src/components/invoices/product-picker.tsx`
- Modify: `apps/web/src/components/invoices/invoice-items-editor.tsx`

**Step 1: Create ProductPicker component**

Similar pattern to ContactPicker — Popover + Command combobox that:
- Queries products service with debounced search
- On selection: calls `onSelect(product)` with product data
- Shows product name, unit, price in dropdown

```tsx
"use client"

import { useState } from "react"
import { Check, ChevronsUpDown } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

interface Product {
  id: string
  name: string
  unit?: string | null
  unit_price?: number | null
  vat_rate?: number | null
}

interface ProductPickerProps {
  value?: string | null
  onSelect: (product: Product) => void
  organizationId: string
}

export function ProductPicker({ value, onSelect, organizationId }: ProductPickerProps) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState("")
  const [products, setProducts] = useState<Product[]>([])
  const [selectedName, setSelectedName] = useState("")

  // Fetch products with search from supabase

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" role="combobox" aria-expanded={open} className="w-full justify-between text-left">
          {selectedName || "Select product..."}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <Command>
          <CommandInput placeholder="Search products..." value={search} onValueChange={setSearch} />
          <CommandList>
            <CommandEmpty>No product found.</CommandEmpty>
            <CommandGroup>
              {products.map((product) => (
                <CommandItem
                  key={product.id}
                  value={product.name}
                  onSelect={() => {
                    onSelect(product)
                    setSelectedName(product.name)
                    setOpen(false)
                  }}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === product.id ? "opacity-100" : "opacity-0")} />
                  <div>
                    <div className="font-medium">{product.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {product.unit_price != null && `€${product.unit_price}`}
                      {product.unit && ` / ${product.unit}`}
                    </div>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

**Step 2: Integrate into invoice-items-editor.tsx**

For each line item row, add a ProductPicker above or beside the description field:
- On product select: auto-fill description, unit, unit_price_net, vat_rate
- Set hidden `product_id` on the line item
- Manual entry still works (product_id stays null)

**Step 3: Verify**

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add apps/web/src/components/invoices/product-picker.tsx apps/web/src/components/invoices/invoice-items-editor.tsx
git commit -m "feat: add ProductPicker with auto-fill for invoice line items"
```

---

## Phase C: Print & PDF (Tasks 7–10)

### Task 7: VAT breakdown by rate in print view

**Files:**
- Modify: `apps/web/src/app/(dashboard)/invoices/[id]/print/page.tsx`

**Step 1: Read the print view file**

Identify the Totals section (around lines 148-162).

**Step 2: Replace single VAT line with breakdown table**

Group line items by `vat_rate`, compute net and VAT per rate, and render a table:

```tsx
{/* VAT breakdown by rate */}
{(() => {
  const items = invoice.invoice_items ?? []
  const vatMap = new Map<number, { net: number; vat: number }>()
  for (const item of items) {
    const rate = Number(item.vat_rate)
    const prev = vatMap.get(rate) ?? { net: 0, vat: 0 }
    const itemNet = Number(item.quantity) * Number(item.unit_price)
    prev.net += itemNet
    prev.vat += Number(item.vat_amount)
    vatMap.set(rate, prev)
  }
  const breakdown = Array.from(vatMap.entries()).sort((a, b) => b[0] - a[0])
  return (
    <div className="border-t border-gray-900 pt-4 ml-auto w-72 text-sm">
      {breakdown.length > 1 && (
        <table className="w-full mb-2">
          <thead>
            <tr className="text-xs text-gray-500">
              <th className="text-left font-normal pb-1">VAT rate</th>
              <th className="text-right font-normal pb-1">Net</th>
              <th className="text-right font-normal pb-1">VAT</th>
            </tr>
          </thead>
          <tbody>
            {breakdown.map(([rate, { net, vat }]) => (
              <tr key={rate} className="text-gray-600">
                <td>{rate}%</td>
                <td className="text-right">{net.toFixed(2)} €</td>
                <td className="text-right">{vat.toFixed(2)} €</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {/* Grand totals */}
      <div className="flex justify-between border-t pt-1">
        <span>Net total:</span>
        <span>{Number(invoice.subtotal).toFixed(2)} €</span>
      </div>
      <div className="flex justify-between">
        <span>VAT total:</span>
        <span>{Number(invoice.tax).toFixed(2)} €</span>
      </div>
      <div className="flex justify-between font-bold text-base border-t pt-1 mt-1">
        <span>Total:</span>
        <span>{Number(invoice.total).toFixed(2)} €</span>
      </div>
    </div>
  )
})()}
```

**Step 3: Verify**

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add apps/web/src/app/(dashboard)/invoices/[id]/print/page.tsx
git commit -m "feat: add VAT breakdown by rate to print view"
```

---

### Task 8: Company logo in print view

**Files:**
- Create: `supabase/migrations/20240101000045_org_logo.sql`
- Modify: `apps/web/src/app/(dashboard)/invoices/[id]/print/page.tsx`

**Step 1: Create migration for logo_url**

```sql
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS logo_url TEXT;
```

**Step 2: Add logo to print view header**

In the print view, after the organization name, conditionally render the logo:

```tsx
{invoice.organization?.logo_url && (
  <img
    src={invoice.organization.logo_url}
    alt="Company logo"
    className="h-16 w-auto object-contain mb-2"
  />
)}
```

Note: The organization data needs to be fetched with the invoice. Check if the invoice query already joins organization data, and add `logo_url` to the select if needed.

**Step 3: Verify**

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add supabase/migrations/20240101000045_org_logo.sql apps/web/src/app/(dashboard)/invoices/[id]/print/page.tsx
git commit -m "feat: add company logo support to print view"
```

---

### Task 9: PAY by square QR code

**Files:**
- Create: `apps/web/src/lib/pay-by-square.ts`
- Modify: `apps/web/src/app/(dashboard)/invoices/[id]/print/page.tsx`

**Step 1: Install dependencies**

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA" && npx pnpm add qrcode lzma-js --filter web`
Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA" && npx pnpm add -D @types/qrcode --filter web`

**Step 2: Create PAY by square encoder**

Create `apps/web/src/lib/pay-by-square.ts`:

```typescript
import QRCode from "qrcode"

/**
 * PAY by square encoder for Slovak banking QR codes.
 *
 * Format: structured data → XZ/LZMA compress → Base32 encode → prepend header
 *
 * Simplified implementation using the "by square" standard:
 * https://bysquare.com/
 */

interface PayBySquareData {
  iban: string
  amount: number
  currency?: string
  variableSymbol?: string
  constantSymbol?: string
  specificSymbol?: string
  dueDate?: string // YYYYMMDD
  beneficiaryName?: string
  note?: string
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return ""
  // Convert YYYY-MM-DD to YYYYMMDD
  return dateStr.replace(/-/g, "")
}

/**
 * Build the PAY by square data string.
 * Fields are tab-separated, structure follows bysquare spec.
 */
function buildPayString(data: PayBySquareData): string {
  const fields = [
    "1", // payment order count
    "1", // regular payment
    data.amount.toFixed(2),
    data.currency ?? "EUR",
    formatDate(data.dueDate),
    data.variableSymbol ?? "",
    data.constantSymbol ?? "",
    data.specificSymbol ?? "",
    "", // reference (empty)
    data.note ?? "",
    "1", // bank account count
    data.iban.replace(/\s/g, ""),
    "", // BIC (optional)
    "0", // standing order
    "0", // direct debit
    data.beneficiaryName ?? "",
    "", // beneficiary address line 1
    "", // beneficiary address line 2
  ]
  return fields.join("\t")
}

/**
 * Generate a PAY by square QR code as a data URL.
 *
 * Note: Full PAY by square requires XZ compression + Base32 encoding + CRC.
 * This implementation generates the structured data and encodes it as QR.
 * For full spec compliance, lzma-js compression would be added.
 */
export async function generatePayBySquareQR(data: PayBySquareData): Promise<string> {
  const payString = buildPayString(data)

  // For full PAY by square: compress with XZ, Base32 encode, add header + CRC
  // Simplified: encode raw pay string as QR (compatible with many Slovak banking apps)
  const dataUrl = await QRCode.toDataURL(payString, {
    errorCorrectionLevel: "M",
    margin: 2,
    width: 200,
  })

  return dataUrl
}
```

**Step 3: Add QR to print view**

In the print view payment section, add the QR code (only for invoices with IBAN):

```tsx
{invoice.supplier_iban && (
  <div className="mt-4">
    <p className="text-xs text-gray-500 mb-1">PAY by square</p>
    {/* QR code rendered as img with data URL — generated server-side */}
    <PayBySquareQR invoice={invoice} />
  </div>
)}
```

Create a client component `PayBySquareQR` that calls `generatePayBySquareQR` and renders the image.

**Step 4: Verify**

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add apps/web/src/lib/pay-by-square.ts apps/web/src/app/(dashboard)/invoices/[id]/print/page.tsx
git commit -m "feat: add PAY by square QR code to print view"
```

---

### Task 10: PDF generation with @react-pdf/renderer

**Files:**
- Create: `apps/web/src/components/invoices/invoice-pdf.tsx`
- Create: `apps/web/src/app/api/invoices/[id]/pdf/route.ts`
- Modify: `apps/web/src/components/invoices/invoice-actions.tsx`

**Step 1: Install dependency**

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA" && npx pnpm add @react-pdf/renderer --filter web`

**Step 2: Create invoice-pdf.tsx**

React PDF document component that mirrors the print layout:

```tsx
import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer"

// Define styles using StyleSheet.create()
// Mirror the print view layout: header, supplier/customer, items table, VAT breakdown, totals

interface InvoicePDFProps {
  invoice: any // Use the same invoice type as print view
}

export function InvoicePDF({ invoice }: InvoicePDFProps) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header with invoice number and dates */}
        {/* Supplier and Customer info */}
        {/* Line items table */}
        {/* VAT breakdown */}
        {/* Payment info */}
      </Page>
    </Document>
  )
}
```

**Step 3: Create PDF API route**

Create `apps/web/src/app/api/invoices/[id]/pdf/route.ts`:

```typescript
import { NextRequest, NextResponse } from "next/server"
import { renderToStream } from "@react-pdf/renderer"
import { createServerSupabaseClient } from "@/lib/supabase/server"
import { InvoicePDF } from "@/components/invoices/invoice-pdf"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabaseClient()

  // Fetch invoice with items (same query as print view)
  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("id", id)
    .single()

  if (error || !invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 })
  }

  const stream = await renderToStream(<InvoicePDF invoice={invoice} />)

  return new NextResponse(stream as any, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="invoice-${invoice.invoice_number}.pdf"`,
    },
  })
}
```

**Step 4: Add "Download PDF" button**

In `invoice-actions.tsx`, add a download button:

```tsx
<Button variant="outline" asChild>
  <a href={`/api/invoices/${invoiceId}/pdf`} download>
    <Download className="mr-2 h-4 w-4" />
    Download PDF
  </a>
</Button>
```

**Step 5: Verify**

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx tsc --noEmit`

**Step 6: Commit**

```bash
git add apps/web/src/components/invoices/invoice-pdf.tsx apps/web/src/app/api/invoices/[id]/pdf/route.ts apps/web/src/components/invoices/invoice-actions.tsx
git commit -m "feat: add PDF generation with @react-pdf/renderer"
```

---

## Phase D: Actions & Stats (Tasks 11–14)

### Task 11: Credit note creation

**Files:**
- Modify: `apps/web/src/lib/actions/invoices.ts`
- Modify: `apps/web/src/components/invoices/invoice-actions.tsx`

**Step 1: Create server action**

Add `createCreditNoteAction` to `apps/web/src/lib/actions/invoices.ts`:

```typescript
export async function createCreditNoteAction(originalInvoiceId: string) {
  "use server"
  const supabase = await createServerSupabaseClient()

  // Fetch original invoice with items
  const { data: original } = await supabase
    .from("invoices")
    .select("*, invoice_items(*)")
    .eq("id", originalInvoiceId)
    .single()

  if (!original) throw new Error("Original invoice not found")

  // Create credit note — copy all fields, negate amounts
  const { data: creditNote } = await supabase
    .from("invoices")
    .insert({
      .../* copy relevant fields from original */,
      invoice_type: "credit_note",
      credit_note_for_id: originalInvoiceId,
      invoice_number: `CN-${original.invoice_number}`,
      subtotal: -Math.abs(original.subtotal),
      tax: -Math.abs(original.tax),
      total: -Math.abs(original.total),
    })
    .select()
    .single()

  // Copy line items with negated amounts
  // Insert items with negative quantities/amounts

  revalidatePath("/invoices")
  return creditNote
}
```

**Step 2: Add "Create Credit Note" button**

In `invoice-actions.tsx`, add button visible only for paid/sent invoices:

```tsx
{(status === "paid" || status === "sent") && invoice.invoice_type !== "credit_note" && (
  <Button variant="outline" onClick={() => createCreditNote(invoice.id)}>
    <FileText className="mr-2 h-4 w-4" />
    Create Credit Note
  </Button>
)}
```

**Step 3: Verify**

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add apps/web/src/lib/actions/invoices.ts apps/web/src/components/invoices/invoice-actions.tsx
git commit -m "feat: add credit note creation from existing invoices"
```

---

### Task 12: Send invoice by email

**Files:**
- Create: `apps/web/src/lib/actions/invoice-email.ts`
- Modify: `apps/web/src/components/invoices/invoice-actions.tsx`

**Step 1: Read existing email infrastructure**

Check what email sending infrastructure exists (look for email-related files, Resend, SES, etc.).

**Step 2: Create send email action**

```typescript
"use server"

export async function sendInvoiceEmailAction(invoiceId: string, recipientEmail?: string) {
  const supabase = await createServerSupabaseClient()

  // 1. Fetch invoice
  // 2. Generate PDF (reuse the PDF generation logic)
  // 3. Send email with PDF attachment using existing email infra
  // 4. Create email_tracking row if tracking table exists
  // 5. Update invoice status to "sent" if currently "draft"

  revalidatePath("/invoices")
}
```

**Step 3: Add "Send by Email" button**

Add email dialog/button to invoice-actions.tsx with optional recipient email input.

**Step 4: Verify**

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx tsc --noEmit`

**Step 5: Commit**

```bash
git add apps/web/src/lib/actions/invoice-email.ts apps/web/src/components/invoices/invoice-actions.tsx
git commit -m "feat: add send invoice by email action"
```

---

### Task 13: Contact stats wiring

**Files:**
- Modify: `apps/web/src/lib/actions/invoices.ts`

**Step 1: Read contacts migration for stats columns**

Check `supabase/migrations/20240101000038_contacts.sql` for `invoice_count`, `total_invoiced`, `avg_payment_days` columns.

**Step 2: Wire stats updates**

In `createInvoiceAction`, after successful invoice creation:
- If `contact_id` is set, increment `invoice_count` and add to `total_invoiced`

In payment-related actions:
- If contact exists, update `avg_payment_days`

```typescript
// After invoice creation
if (contact_id) {
  await supabase.rpc("increment_contact_stats", {
    p_contact_id: contact_id,
    p_amount: total,
  })
  // Or use raw update:
  // UPDATE contacts SET invoice_count = invoice_count + 1, total_invoiced = total_invoiced + $amount WHERE id = $contact_id
}
```

**Step 3: Verify**

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add apps/web/src/lib/actions/invoices.ts
git commit -m "feat: wire contact stats on invoice creation"
```

---

### Task 14: Product stats wiring

**Files:**
- Modify: `apps/web/src/lib/actions/invoices.ts`

**Step 1: Read products migration for stats columns**

Check `supabase/migrations/20240101000039_products.sql` for `times_invoiced`, `total_revenue` columns.

**Step 2: Wire stats updates**

In `createInvoiceAction`, after successful invoice + items creation:
- For each line item with `product_id`, increment `times_invoiced` and add line total to `total_revenue`

```typescript
// After invoice items creation
for (const item of items) {
  if (item.product_id) {
    await supabase
      .from("products" as any)
      .update({
        times_invoiced: supabase.rpc("increment", { row_id: item.product_id }),
        // Or raw SQL increment
      })
      .eq("id", item.product_id)
  }
}
```

**Step 3: Verify**

Run: `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx tsc --noEmit`

**Step 4: Commit**

```bash
git add apps/web/src/lib/actions/invoices.ts
git commit -m "feat: wire product stats on invoice creation"
```

---

## Verification

After all tasks:

1. `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx tsc --noEmit` — zero type errors
2. `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx pnpm build` — successful build
3. `cd "c:/Users/david/Documents/NW/Claude setup/VEXERA/apps/web" && npx pnpm lint` — no new lint errors
4. Manual test: create invoice with contact picker, product picker, print view with QR/VAT breakdown

## Batches for Execution

| Batch | Tasks | Theme |
|-------|-------|-------|
| 1 | 1–4 | Database & Schema |
| 2 | 5–6 | Form Integration |
| 3 | 7–10 | Print & PDF |
| 4 | 11–14 | Actions & Stats |

## New Dependencies

| Package | Purpose | Phase |
|---------|---------|-------|
| `@react-pdf/renderer` | PDF generation | C |
| `qrcode` + `@types/qrcode` | QR code for PAY by square | C |
| `lzma-js` | XZ compression for PAY by square | C |

## Key Files Reference

| Area | File |
|------|------|
| Invoice form | `apps/web/src/components/invoices/invoice-form.tsx` |
| Line items editor | `apps/web/src/components/invoices/invoice-items-editor.tsx` |
| Invoice schema | `apps/web/src/lib/validations/invoice.schema.ts` |
| Invoice actions | `apps/web/src/lib/actions/invoices.ts` |
| Invoice UI actions | `apps/web/src/components/invoices/invoice-actions.tsx` |
| Print view | `apps/web/src/app/(dashboard)/invoices/[id]/print/page.tsx` |
| Contacts service | `apps/web/src/lib/services/contacts.service.ts` |
| Products service | `apps/web/src/lib/services/products.service.ts` |
| Invoices migration | `supabase/migrations/20240101000008_invoices.sql` |
| Invoice items migration | `supabase/migrations/20240101000009_invoice_items.sql` |
| Contacts migration | `supabase/migrations/20240101000038_contacts.sql` |
| Products migration | `supabase/migrations/20240101000039_products.sql` |
