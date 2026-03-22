"use client"

import type { UseFormReturn } from "react-hook-form"
import type { WizardFormValues } from "../../schemas"
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/shared/components/ui/form"
import { Input } from "@/shared/components/ui/input"

export function StepBusinessIdentity({
  form,
}: {
  form: UseFormReturn<WizardFormValues>
}) {
  return (
    <div className="space-y-5">
      {/* Name */}
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Obchodne meno / Nazov</FormLabel>
            <FormControl>
              <Input placeholder="Napr. Jan Novak" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* ICO / DIC / IC DPH */}
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          control={form.control}
          name="ico"
          render={({ field }) => (
            <FormItem>
              <FormLabel>ICO</FormLabel>
              <FormControl>
                <Input placeholder="12345678" maxLength={8} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="dic"
          render={({ field }) => (
            <FormItem>
              <FormLabel>DIC</FormLabel>
              <FormControl>
                <Input placeholder="1234567890" maxLength={10} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="ic_dph"
          render={({ field }) => (
            <FormItem>
              <FormLabel>IC DPH</FormLabel>
              <FormControl>
                <Input placeholder="SK1234567890" maxLength={12} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      {/* Address street */}
      <FormField
        control={form.control}
        name="address_street"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Ulica a cislo</FormLabel>
            <FormControl>
              <Input placeholder="Hlavna 1" {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* City and ZIP */}
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          control={form.control}
          name="address_city"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mesto</FormLabel>
              <FormControl>
                <Input placeholder="Bratislava" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address_zip"
          render={({ field }) => (
            <FormItem>
              <FormLabel>PSC</FormLabel>
              <FormControl>
                <Input placeholder="811 01" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>
    </div>
  )
}
