import { Suspense } from "react"
import { InboxIcon } from "lucide-react"
import { getActiveOrgId } from "@/lib/data/org"
import { getInboxDocuments, getInboxStats } from "@/lib/data/inbox"
import { InboxClient } from "@/components/inbox/inbox-client"
import { Skeleton } from "@/components/ui/skeleton"

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
        <p className="text-muted-foreground">Select an organization to view inbox</p>
      </div>
    )
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inbox</h1>
        <p className="text-muted-foreground">Review and approve documents awaiting processing</p>
      </div>
      <Suspense fallback={<Skeleton className="h-96 w-full rounded-xl" />}>
        <InboxContent />
      </Suspense>
    </div>
  )
}
