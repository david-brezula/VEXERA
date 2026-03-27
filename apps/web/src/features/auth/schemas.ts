import { z } from "zod"

export const loginSchema = z.object({
  email: z.email("Zadajte platnú e-mailovú adresu"),
  password: z.string().min(6, "Heslo musí mať aspoň 6 znakov"),
})

export type LoginFormValues = z.infer<typeof loginSchema>

export const registerSchema = z.object({
  fullName: z.string().min(2, "Meno musí mať aspoň 2 znaky"),
  email: z.email("Zadajte platnú e-mailovú adresu"),
  password: z.string().min(8, "Heslo musí mať aspoň 8 znakov"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Heslá sa nezhodujú",
  path: ["confirmPassword"],
})

export type RegisterFormValues = z.infer<typeof registerSchema>
