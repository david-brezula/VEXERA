"use client"

import type { UseFormReturn } from "react-hook-form"
import type { WizardFormValues } from "../../schemas"
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
} from "@/shared/components/ui/form"
import { Switch } from "@/shared/components/ui/switch"

const STATUS_FIELDS = [
  {
    name: "is_student" as const,
    label: "Ste student?",
    description: "Studenti su oslobodeni od minimalnych zdravotnych odvodov.",
  },
  {
    name: "is_disabled" as const,
    label: "Ste osoba so zdravotnym postihnutim (ZTP)?",
    description: "ZTP osoby maju znizenu sadzbu zdravotnych odvodov.",
  },
  {
    name: "is_pensioner" as const,
    label: "Ste dochodca?",
    description: "Dochodcovia su oslobodeni od socialnych odvodov.",
  },
  {
    name: "has_other_employment" as const,
    label: "Ste zaroven zamestnanec?",
    description:
      "Ak ste aj zamestnanec, minimalne zdravotne odvody sa neuplatnuju.",
  },
] as const

export function StepPersonalStatus({
  form,
}: {
  form: UseFormReturn<WizardFormValues>
}) {
  return (
    <div className="space-y-5">
      {STATUS_FIELDS.map((field) => (
        <FormField
          key={field.name}
          control={form.control}
          name={field.name}
          render={({ field: formField }) => (
            <FormItem className="flex items-center justify-between rounded-lg border p-4">
              <div className="space-y-0.5">
                <FormLabel className="text-base">{field.label}</FormLabel>
                <FormDescription>{field.description}</FormDescription>
              </div>
              <FormControl>
                <Switch
                  checked={formField.value}
                  onCheckedChange={formField.onChange}
                />
              </FormControl>
            </FormItem>
          )}
        />
      ))}
    </div>
  )
}
