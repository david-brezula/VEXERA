"use client"

import { format } from "date-fns"
import { sk } from "date-fns/locale"
import { CalendarIcon, Info } from "lucide-react"
import type { UseFormReturn } from "react-hook-form"
import type { WizardFormValues } from "../../schemas"
import {
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormDescription,
  FormMessage,
} from "@/shared/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/shared/components/ui/select"
import { Switch } from "@/shared/components/ui/switch"
import { Calendar } from "@/shared/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/shared/components/ui/popover"
import { Button } from "@/shared/components/ui/button"
import { cn } from "@/lib/utils"

export function StepBusinessDetails({
  form,
}: {
  form: UseFormReturn<WizardFormValues>
}) {
  return (
    <div className="space-y-5">
      {/* Founding date */}
      <FormField
        control={form.control}
        name="founding_date"
        render={({ field }) => (
          <FormItem className="flex flex-col">
            <FormLabel>Datum zalozenia zivnosti</FormLabel>
            <Popover>
              <PopoverTrigger asChild>
                <FormControl>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full pl-3 text-left font-normal",
                      !field.value && "text-muted-foreground"
                    )}
                  >
                    {field.value
                      ? format(new Date(field.value), "d. MMMM yyyy", {
                          locale: sk,
                        })
                      : "Vyberte datum"}
                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                  </Button>
                </FormControl>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={field.value ? new Date(field.value) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      const iso = format(date, "yyyy-MM-dd")
                      field.onChange(iso)
                    }
                  }}
                  disabled={(date) => date > new Date()}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Info box */}
      <div className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-800 dark:bg-blue-950 dark:text-blue-200">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <p>
          Na zaklade datumu zalozenia automaticky urcime, ci ste v prvom roku
          podnikania.
        </p>
      </div>

      {/* Tax regime */}
      <FormField
        control={form.control}
        name="tax_regime"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Danovy rezim</FormLabel>
            <Select onValueChange={field.onChange} defaultValue={field.value}>
              <FormControl>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Vyberte danovy rezim" />
                </SelectTrigger>
              </FormControl>
              <SelectContent>
                <SelectItem value="pausalne_vydavky">
                  Pausalne vydavky (60%)
                </SelectItem>
                <SelectItem value="naklady">Skutocne naklady</SelectItem>
              </SelectContent>
            </Select>
            <FormDescription>
              Pausalne vydavky su jednoduchsie - nemusite evidovat jednotlive
              naklady.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* DPH registration */}
      <FormField
        control={form.control}
        name="registered_dph"
        render={({ field }) => (
          <FormItem className="flex items-center justify-between rounded-lg border p-4">
            <div className="space-y-0.5">
              <FormLabel className="text-base">Platca DPH</FormLabel>
              <FormDescription>
                Ste registrovany platca dane z pridanej hodnoty?
              </FormDescription>
            </div>
            <FormControl>
              <Switch checked={field.value} onCheckedChange={field.onChange} />
            </FormControl>
          </FormItem>
        )}
      />
    </div>
  )
}
