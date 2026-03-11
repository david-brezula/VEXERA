import { Suspense } from "react"
import { PLPageClient } from "@/components/reports/pl-page-client"

export const metadata = {
  title: "Client P&L | Vexera",
}

export default function ClientPLPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">P&L podľa klientov</h1>
        <p className="text-muted-foreground mt-1">
          Ziskovosť podľa klientov — tržby, náklady a marža
        </p>
      </div>

      <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Načítavam...</div>}>
        <PLPageClient tagType="client" />
      </Suspense>
    </div>
  )
}
