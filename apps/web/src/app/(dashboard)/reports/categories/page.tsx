import { Suspense } from "react"
import { CategoriesPageClient } from "@/features/reports/components/categories-page-client"

export const metadata = {
  title: "Category Reports | Vexera",
}

export default function CategoriesReportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Kategórie nákladov a výnosov</h1>
        <p className="text-muted-foreground mt-1">
          Rozdelenie nákladov a výnosov podľa kategórií s drill-down
        </p>
      </div>

      <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Načítavam...</div>}>
        <CategoriesPageClient />
      </Suspense>
    </div>
  )
}
