import { Suspense } from "react"
import { ArchiveSettings } from "@/features/settings/components/archive-settings"

export const metadata = {
  title: "Archive Settings | Vexera",
}

export default function ArchiveSettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Elektronický archív</h1>
        <p className="text-muted-foreground mt-1">
          Správa archivačných pravidiel a doby uchovávania dokumentov
        </p>
      </div>

      <Suspense fallback={<div className="py-8 text-center text-muted-foreground">Načítavam...</div>}>
        <ArchiveSettings />
      </Suspense>
    </div>
  )
}
