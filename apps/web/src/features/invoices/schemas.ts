import { z } from "zod"
import type { VatRate } from "@vexera/types"
import { SLOVAK_VAT_RATES } from "@vexera/utils"

/** Default Slovak VAT rate (since 2025) */
export const DEFAULT_VAT_RATE: VatRate = 23

// ─── VAT rate helpers ─────────────────────────────────────────────────────────

/** Returns available VAT rates based on DPH registration status */
export function getAvailableVatRates(isDphRegistered: boolean): readonly VatRate[] {
  if (!isDphRegistered) return [0] as const
  return SLOVAK_VAT_RATES
}

/** Returns the default VAT rate for new invoice items */
export function getDefaultVatRate(isDphRegistered: boolean): VatRate {
  return isDphRegistered ? 23 : 0
}

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
    z.literal(23),
    z.literal(19),
    z.literal(5),
    z.literal(0),
  ]),
  sort_order: z.number().int().default(0),
  product_id: z.string().uuid().optional().or(z.literal("")),
})

export type InvoiceItemFormValues = z.infer<typeof invoiceItemSchema>

// ─── Full invoice form ────────────────────────────────────────────────────────

export const invoiceSchema = z.object({
  // Identification
  invoice_type: z.enum(["issued", "received", "credit_note"]),
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

  // Contact reference
  contact_id: z.string().uuid().optional().or(z.literal("")),

  // Line items — must have at least one
  items: z
    .array(invoiceItemSchema)
    .min(1, "Add at least one line item"),
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

export type InvoiceFormValues = z.infer<typeof invoiceSchema>

// ─── Organization data for auto-populating invoice defaults ──────────────────

type OrgData = {
  name: string
  ico: string
  dic: string | null
  ic_dph: string | null
  address_street: string | null
  address_city: string | null
  address_zip: string | null
  bank_iban: string | null
}

export function orgToInvoiceDefaults(
  org: OrgData | null,
  type: "issued" | "received" = "issued"
): InvoiceFormValues {
  const base = defaultInvoiceValues(type)
  if (!org) return base

  const address = [org.address_street, org.address_city, org.address_zip]
    .filter(Boolean)
    .join(", ")

  if (type === "issued") {
    return {
      ...base,
      supplier_name: org.name,
      supplier_ico: org.ico ?? "",
      supplier_dic: org.dic ?? "",
      supplier_ic_dph: org.ic_dph ?? "",
      supplier_address: address,
      supplier_iban: org.bank_iban ?? "",
      bank_iban: org.bank_iban ?? "",
    }
  }

  // received — org is the customer
  return {
    ...base,
    customer_name: org.name,
    customer_ico: org.ico ?? "",
    customer_dic: org.dic ?? "",
    customer_ic_dph: org.ic_dph ?? "",
    customer_address: address,
  }
}

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
        vat_rate: 23,
        sort_order: 0,
        product_id: "",
      },
    ],
    contact_id: "",
  }
}
