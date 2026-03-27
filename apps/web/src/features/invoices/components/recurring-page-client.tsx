"use client"

import Link from "next/link"
import { PlusIcon } from "lucide-react"

import { useRecurringInvoices } from "../hooks-recurring"
import { Button } from "@/shared/components/ui/button"
import { RecurringTemplateTable } from "./recurring-template-table"

export function RecurringPageClient() {
  const { data: templates = [] } = useRecurringInvoices()

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {templates.length} {templates.length === 1 ? "šablóna" : "šablón"}
        </p>
        <Link href="/invoices/recurring/new">
          <Button>
            <PlusIcon className="size-4 mr-1" />
            Nová šablóna
          </Button>
        </Link>
      </div>

      <RecurringTemplateTable templates={templates} />
    </>
  )
}
