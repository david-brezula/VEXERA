import { z } from "zod"

export const createOrganizationSchema = z.object({
  name: z.string().min(2, "Organization name must be at least 2 characters"),
  ico: z
    .string()
    .min(8, "ICO must be 8 digits")
    .max(8, "ICO must be 8 digits")
    .regex(/^\d{8}$/, "ICO must be exactly 8 digits"),
  dic: z
    .string()
    .regex(/^\d{10}$/, "DIC must be exactly 10 digits")
    .optional()
    .or(z.literal("")),
  ic_dph: z
    .string()
    .regex(/^SK\d{10}$/, "IC DPH must be in format SK + 10 digits")
    .optional()
    .or(z.literal("")),
  address_street: z.string().optional(),
  address_city: z.string().optional(),
  address_zip: z.string().optional(),
  address_country: z.string().optional().default("SK"),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  bank_iban: z.string().optional(),
  bank_swift: z.string().optional(),
})

export type CreateOrganizationFormValues = z.input<
  typeof createOrganizationSchema
>
