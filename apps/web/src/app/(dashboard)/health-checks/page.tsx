import { Suspense } from "react"

import { HealthChecksPageClient } from "@/features/reports/health-checks/components/health-checks-page-client"
import HealthChecksLoading from "./loading"

export const metadata = {
  title: "Kontrola kvality | Vexera",
}

export default function HealthChecksPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kontrola kvality</h1>
        <p className="text-muted-foreground mt-1">
          Automatická kontrola kvality dokladov a identifikácia problémov
        </p>
      </div>

      <Suspense fallback={<HealthChecksLoading />}>
        <HealthChecksPageClient />
      </Suspense>
    </div>
  )
}
