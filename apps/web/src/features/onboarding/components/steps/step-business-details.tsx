"use client"

import { useState, useEffect } from "react"
import { Info } from "lucide-react"
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

const MONTHS = [
  "Januar", "Februar", "Marec", "April", "Maj", "Jun",
  "Jul", "August", "September", "Oktober", "November", "December",
]

function getDaysInMonth(month: number, year: number): number {
  if (!month || !year) return 31
  return new Date(year, month, 0).getDate()
}

export function StepBusinessDetails({
  form,
}: {
  form: UseFormReturn<WizardFormValues>
}) {
  // Parse initial value from form into local state for partial selections
  const currentValue = form.watch("founding_date")
  const [day, setDay] = useState("")
  const [month, setMonth] = useState("")
  const [year, setYear] = useState("")

  // Sync from form value on mount / external changes
  useEffect(() => {
    if (currentValue && currentValue.includes("-")) {
      const [y, m, d] = currentValue.split("-")
      setDay(String(Number(d)))
      setMonth(String(Number(m)))
      setYear(y)
    }
  }, [currentValue])

  const now = new Date()
  const currentYear = now.getFullYear()
  const daysInMonth = getDaysInMonth(Number(month), Number(year))

  // Update form value whenever all three parts are filled
  function updatePart(part: "day" | "month" | "year", value: string) {
    const nextDay = part === "day" ? value : day
    const nextMonth = part === "month" ? value : month
    const nextYear = part === "year" ? value : year

    if (part === "day") setDay(value)
    if (part === "month") setMonth(value)
    if (part === "year") setYear(value)

    if (nextDay && nextMonth && nextYear) {
      const d = nextDay.padStart(2, "0")
      const m = nextMonth.padStart(2, "0")
      form.setValue("founding_date", `${nextYear}-${m}-${d}`, { shouldValidate: true })
    }
  }

  return (
    <div className="space-y-5">
      {/* Founding date - 3 selects */}
      <FormField
        control={form.control}
        name="founding_date"
        render={() => (
          <FormItem>
            <FormLabel>Datum zalozenia zivnosti</FormLabel>
            <div className="grid grid-cols-3 gap-3">
              <Select value={day} onValueChange={(v) => updatePart("day", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Den" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: daysInMonth }, (_, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {i + 1}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={month} onValueChange={(v) => updatePart("month", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Mesiac" />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((name, i) => (
                    <SelectItem key={i + 1} value={String(i + 1)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={year} onValueChange={(v) => updatePart("year", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Rok" />
                </SelectTrigger>
                <SelectContent>
                  {Array.from({ length: 35 }, (_, i) => currentYear - i).map((year) => (
                    <SelectItem key={year} value={String(year)}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
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
