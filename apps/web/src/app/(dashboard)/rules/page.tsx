import { Suspense } from "react"

import { RulesPageClient } from "@/features/rules/components/rules-page-client"
import RulesLoading from "./loading"

export const metadata = {
  title: "Rules | Vexera",
}

export default function RulesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pravidlá</h1>
        <p className="text-muted-foreground mt-1">
          Automatizujte kategorizáciu dokladov a transakcií
        </p>
      </div>

      <Suspense fallback={<RulesLoading />}>
        <RulesPageClient />
      </Suspense>
    </div>
  )
}
