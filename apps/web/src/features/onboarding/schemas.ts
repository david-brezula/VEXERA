import { z } from "zod"

// Step 1: Business Identity
export const step1Schema = z.object({
  name: z.string().min(2, "Nazov musi mat aspon 2 znaky"),
  ico: z
    .string()
    .min(8, "ICO musi mat 8 cislic")
    .max(8, "ICO musi mat 8 cislic")
    .regex(/^\d{8}$/, "ICO musi byt presne 8 cislic"),
  dic: z
    .string()
    .regex(/^\d{10}$/, "DIC musi byt presne 10 cislic")
    .optional()
    .or(z.literal("")),
  ic_dph: z
    .string()
    .regex(/^SK\d{10}$/, "IC DPH musi byt vo formate SK + 10 cislic")
    .optional()
    .or(z.literal("")),
  address_street: z.string().optional().or(z.literal("")),
  address_city: z.string().optional().or(z.literal("")),
  address_zip: z.string().optional().or(z.literal("")),
})

// Step 2: Business Details
export const step2Schema = z.object({
  founding_date: z.string().min(1, "Vyberte datum zalozenia"),
  tax_regime: z.enum(["pausalne_vydavky", "naklady"]),
  registered_dph: z.boolean(),
})

// Step 3: Personal Status
export const step3Schema = z.object({
  is_student: z.boolean(),
  is_disabled: z.boolean(),
  is_pensioner: z.boolean(),
  has_other_employment: z.boolean(),
})

// Step 4: Insurance (conditional)
export const step4Schema = z.object({
  paid_social_monthly: z.number().min(0).optional(),
  paid_health_monthly: z.number().min(0).optional(),
})

// Combined schema for the full wizard form
export const wizardSchema = step1Schema
  .merge(step2Schema)
  .merge(step3Schema)
  .merge(step4Schema)

export type WizardFormValues = z.infer<typeof wizardSchema>

// Step schemas array for per-step validation
export const stepSchemas = [
  step1Schema,
  step2Schema,
  step3Schema,
  step4Schema,
] as const
