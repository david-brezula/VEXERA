import { Suspense } from "react"
import { PLPageClient } from "@/features/reports/components/pl-page-client"

export const metadata = {
  title: "Project P&L | Vexera",
}

export default function ProjectPLPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">P&L podľa projektov</h1>
        <p className="text-muted-foreground mt-1">
          Sledovanie rentability jednotlivých projektov
        </p>
      </div>

      <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Načítavam...</div>}>
        <PLPageClient tagType="project" />
      </Suspense>
    </div>
  )
}
