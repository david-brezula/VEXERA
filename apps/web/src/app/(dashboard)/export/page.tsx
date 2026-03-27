import { ExportPageClient } from "@/features/export/components/export-page-client"

export const metadata = { title: "Export | Vexera" }

export default function ExportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Export</h1>
        <p className="text-muted-foreground">Exportujte účtovné dáta do vášho softvéru</p>
      </div>
      <ExportPageClient />
    </div>
  )
}
