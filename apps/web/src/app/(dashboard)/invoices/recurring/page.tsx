import { Suspense } from "react"
import { RecurringPageClient } from "@/components/invoices/recurring-page-client"

export const metadata = {
  title: "Recurring Invoices | Vexera",
}

export default function RecurringInvoicesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Opakované faktúry</h1>
        <p className="text-muted-foreground mt-1">
          Automatické generovanie faktúr podľa nastaveného rozvrhu
        </p>
      </div>

      <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Načítavam...</div>}>
        <RecurringPageClient />
      </Suspense>
    </div>
  )
}
