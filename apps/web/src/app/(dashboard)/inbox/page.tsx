import { Suspense } from "react"
import { InboxIcon } from "lucide-react"
import { getActiveOrgId } from "@/features/settings/data-org"
import { getInboxDocuments, getInboxStats } from "@/features/notifications/data"
import { InboxClient } from "@/features/notifications/components/inbox-client"
import { Skeleton } from "@/shared/components/ui/skeleton"

export const metadata = { title: "Inbox | Vexera" }

async function InboxContent() {
  const [documents, stats] = await Promise.all([getInboxDocuments(), getInboxStats()])
  return <InboxClient documents={documents} stats={stats} />
}

export default async function InboxPage() {
  const orgId = await getActiveOrgId()
  if (!orgId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <InboxIcon className="size-12 text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Vyberte organizáciu pre zobrazenie doručených</p>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Doručené</h1>
        <p className="text-muted-foreground">Skontrolujte a schváľte doklady čakajúce na spracovanie</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <InboxContent />
      </Suspense>
    </div>
  )
}
