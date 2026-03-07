import { z } from "zod"

// ─── Invoice item (one line on the invoice) ───────────────────────────────────

export const invoiceItemSchema = z.object({
  id: z.string().uuid().optional(), // present on existing items, absent on new ones
  description: z.string().min(1, "Description is required"),
  quantity: z
    .number({ error: "Must be a number" })
    .positive("Must be greater than 0"),
  unit: z.string().optional().default("ks"),
  unit_price_net: z
    .number({ error: "Must be a number" })
    .min(0, "Cannot be negative"),
  vat_rate: z.union([
    z.literal(20),
    z.literal(10),
    z.literal(5),
    z.literal(0),
  ]),
  sort_order: z.number().int().default(0),
})

export type InvoiceItemFormValues = z.infer<typeof invoiceItemSchema>

// ─── Full invoice form ────────────────────────────────────────────────────────

export const invoiceSchema = z.object({
  // Identification
  invoice_type: z.enum(["issued", "received"]),
  invoice_number: z.string().min(1, "Invoice number is required"),

  // Supplier (Dodávateľ)
  supplier_name: z.string().min(1, "Supplier name is required"),
  supplier_ico: z.string().optional().or(z.literal("")),
  supplier_dic: z.string().optional().or(z.literal("")),
  supplier_ic_dph: z.string().optional().or(z.literal("")),
  supplier_address: z.string().optional().or(z.literal("")),
  supplier_iban: z.string().optional().or(z.literal("")),

  // Customer (Odberateľ)
  customer_name: z.string().min(1, "Customer name is required"),
  customer_ico: z.string().optional().or(z.literal("")),
  customer_dic: z.string().optional().or(z.literal("")),
  customer_ic_dph: z.string().optional().or(z.literal("")),
  customer_address: z.string().optional().or(z.literal("")),

  // Dates (stored as ISO date strings: "YYYY-MM-DD")
  issue_date: z.string().min(1, "Issue date is required"),
  delivery_date: z.string().optional().or(z.literal("")),
  due_date: z.string().min(1, "Due date is required"),

  // Payment
  payment_method: z.enum(["bank_transfer", "cash", "card", "other"]).default("bank_transfer"),
  bank_iban: z.string().optional().or(z.literal("")),
  variable_symbol: z.string().optional().or(z.literal("")),
  constant_symbol: z.string().optional().or(z.literal("")),
  specific_symbol: z.string().optional().or(z.literal("")),

  // Notes
  notes: z.string().optional().or(z.literal("")),
  internal_notes: z.string().optional().or(z.literal("")),

  // Currency
  currency: z.string().default("EUR"),

  // Line items — must have at least one
  items: z
    .array(invoiceItemSchema)
    .min(1, "Add at least one line item"),
})

export type InvoiceFormValues = z.infer<typeof invoiceSchema>

// ─── Default values for an empty new invoice ─────────────────────────────────

export function defaultInvoiceValues(type: "issued" | "received" = "issued"): InvoiceFormValues {
  const today = new Date().toISOString().slice(0, 10)
  const due = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

  return {
    invoice_type: type,
    invoice_number: "", // filled by hook after generation
    supplier_name: "",
    supplier_ico: "",
    supplier_dic: "",
    supplier_ic_dph: "",
    supplier_address: "",
    supplier_iban: "",
    customer_name: "",
    customer_ico: "",
    customer_dic: "",
    customer_ic_dph: "",
    customer_address: "",
    issue_date: today,
    delivery_date: "",
    due_date: due,
    payment_method: "bank_transfer",
    bank_iban: "",
    variable_symbol: "",
    constant_symbol: "",
    specific_symbol: "",
    notes: "",
    internal_notes: "",
    currency: "EUR",
    items: [
      {
        description: "",
        quantity: 1,
        unit: "ks",
        unit_price_net: 0,
        vat_rate: 20,
        sort_order: 0,
      },
    ],
  }
}
