"use client"

import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"
import { Button } from "@/shared/components/ui/button"
import { InvoiceForm } from "@/features/invoices/components/invoice-form"

export default function NewInvoicePage() {
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/invoices">
            <ChevronLeftIcon className="size-4" />
            Invoices
          </Link>
        </Button>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">New invoice</h1>
        <p className="text-muted-foreground">
          Fill in the details below. The invoice number is auto-generated.
        </p>
      </div>

      <InvoiceForm />
    </div>
  )
}
