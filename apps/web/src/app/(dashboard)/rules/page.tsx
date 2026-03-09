import { Suspense } from "react"

import { RulesPageClient } from "@/components/rules/rules-page-client"
import RulesLoading from "./loading"

export const metadata = {
  title: "Rules | Vexera",
}

export default function RulesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Rules</h1>
        <p className="text-muted-foreground mt-1">
          Automate categorization of documents and transactions
        </p>
      </div>

      <Suspense fallback={<RulesLoading />}>
        <RulesPageClient />
      </Suspense>
    </div>
  )
}
