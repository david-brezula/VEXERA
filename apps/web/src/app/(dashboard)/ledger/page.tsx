"use client"

import { BookOpen } from "lucide-react"

export default function LedgerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Ledger</h1>
        <p className="text-muted-foreground">
          General ledger and accounting entries
        </p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12">
        <BookOpen className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No entries yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Ledger management will be available in Phase 2.
        </p>
      </div>
    </div>
  )
}
