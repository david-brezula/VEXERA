"use client"

import { FileText } from "lucide-react"

export default function InvoicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
        <p className="text-muted-foreground">
          Manage your issued and received invoices
        </p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12">
        <FileText className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No invoices yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Invoice management will be available in Phase 1.
        </p>
      </div>
    </div>
  )
}
