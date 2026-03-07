import { ExportPageClient } from "@/components/export/export-page-client"

export const metadata = { title: "Export | Vexera" }

export default function ExportPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Export</h1>
        <p className="text-muted-foreground">Export accounting data to your software</p>
      </div>
      <ExportPageClient />
    </div>
  )
}
