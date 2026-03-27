"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/shared/components/ui/select"

interface PeriodSelectorProps {
  value: string
  onValueChange: (value: string) => void
}

function getPeriodOptions() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()

  const options: { label: string; value: string; from: string; to: string }[] = []

  // Current month
  const currentFrom = `${year}-${String(month + 1).padStart(2, "0")}-01`
  const nextMonth = month === 11 ? new Date(year + 1, 0, 0) : new Date(year, month + 1, 0)
  const currentTo = `${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, "0")}-${String(nextMonth.getDate()).padStart(2, "0")}`
  options.push({ label: "Aktuálny mesiac", value: "current_month", from: currentFrom, to: currentTo })

  // Previous month
  const prevMonth = month === 0 ? 11 : month - 1
  const prevYear = month === 0 ? year - 1 : year
  const prevFrom = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-01`
  const prevEnd = new Date(prevYear, prevMonth + 1, 0)
  const prevTo = `${prevYear}-${String(prevMonth + 1).padStart(2, "0")}-${String(prevEnd.getDate()).padStart(2, "0")}`
  options.push({ label: "Predchádzajúci mesiac", value: "prev_month", from: prevFrom, to: prevTo })

  // Current quarter
  const qStart = Math.floor(month / 3) * 3
  const qFrom = `${year}-${String(qStart + 1).padStart(2, "0")}-01`
  const qEnd = new Date(year, qStart + 3, 0)
  const qTo = `${year}-${String(qEnd.getMonth() + 1).padStart(2, "0")}-${String(qEnd.getDate()).padStart(2, "0")}`
  options.push({ label: "Aktuálny kvartál", value: "current_quarter", from: qFrom, to: qTo })

  // Current year
  options.push({ label: `Rok ${year}`, value: "current_year", from: `${year}-01-01`, to: `${year}-12-31` })

  // Previous year
  options.push({ label: `Rok ${year - 1}`, value: "prev_year", from: `${year - 1}-01-01`, to: `${year - 1}-12-31` })

  return options
}

export const periodOptions = getPeriodOptions()

export function PeriodSelector({ value, onValueChange }: PeriodSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder="Vyberte obdobie" />
      </SelectTrigger>
      <SelectContent>
        {periodOptions.map((opt) => (
          <SelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
