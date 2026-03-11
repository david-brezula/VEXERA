import { Suspense } from "react"
import { RemainingWorkPageClient } from "@/components/reports/remaining-work-page-client"

export const metadata = {
  title: "Remaining Work | Vexera",
}

export default function RemainingWorkPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Zostávajúca práca</h1>
        <p className="text-muted-foreground mt-1">
          Prehľad pripravenosti klientov pred daňovými termínmi
        </p>
      </div>

      <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Načítavam...</div>}>
        <RemainingWorkPageClient />
      </Suspense>
    </div>
  )
}
