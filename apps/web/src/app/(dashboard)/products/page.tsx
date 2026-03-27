import { Suspense } from "react"
import { ProductsPageClient } from "@/features/products/components/products-page-client"

export const metadata = {
  title: "Products | Vexera",
}

export default function ProductsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Katalóg produktov a služieb</h1>
        <p className="text-muted-foreground mt-1">
          Spravujte produkty a služby pre rýchlejšie vytváranie faktúr
        </p>
      </div>

      <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Načítavam...</div>}>
        <ProductsPageClient />
      </Suspense>
    </div>
  )
}
