"use client"

import { Info } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"
import type { WizardFormValues } from "../../schemas"
import { SLOVAK_TAX_LEGISLATION_2026 } from "@vexera/utils"
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/shared/components/ui/form"
import { Input } from "@/shared/components/ui/input"

const { insurance } = SLOVAK_TAX_LEGISLATION_2026

export function StepInsurance({
  form,
}: {
  form: UseFormReturn<WizardFormValues>
}) {
  return (
    <div className="space-y-5">
      {/* Info box */}
      <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Zadajte vasu mesacnu sumu socialnych a zdravotnych odvodov. Ak neviete
          presnu sumu, nechajte predvyplnene minimalne odvody.
        </p>
      </div>

      {/* Social insurance */}
      <FormField
        control={form.control}
        name="paid_social_monthly"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mesacne socialne odvody</FormLabel>
            <FormControl>
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder={String(insurance.minSocialMonthly)}
                value={field.value ?? ""}
                onChange={(e) => {
                  const val = e.target.value
                  field.onChange(val === "" ? undefined : parseFloat(val))
                }}
              />
            </FormControl>
            <FormDescription>
              Minimalne socialne odvody pre rok 2026:{" "}
              {insurance.minSocialMonthly} EUR/mesiac
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Health insurance */}
      <FormField
        control={form.control}
        name="paid_health_monthly"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Mesacne zdravotne odvody</FormLabel>
            <FormControl>
              <Input
                type="number"
                step="0.01"
                min={0}
                placeholder={String(insurance.minHealthMonthly)}
                value={field.value ?? ""}
                onChange={(e) => {
                  const val = e.target.value
                  field.onChange(val === "" ? undefined : parseFloat(val))
                }}
              />
            </FormControl>
            <FormDescription>
              Minimalne zdravotne odvody pre rok 2026:{" "}
              {insurance.minHealthMonthly} EUR/mesiac
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  )
}
