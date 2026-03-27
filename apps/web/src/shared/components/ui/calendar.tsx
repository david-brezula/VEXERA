"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { sk } from "date-fns/locale"
import { cn } from "@/lib/utils"

import "react-day-picker/style.css"

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      locale={sk}
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        ...classNames,
      }}
      {...props}
    />
  )
}

export { Calendar }
