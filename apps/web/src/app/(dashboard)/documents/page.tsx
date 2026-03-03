"use client"

import { FolderOpen } from "lucide-react"

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Documents</h1>
        <p className="text-muted-foreground">
          Upload and manage your accounting documents
        </p>
      </div>
      <div className="flex flex-col items-center justify-center rounded-md border border-dashed p-12">
        <FolderOpen className="h-12 w-12 text-muted-foreground" />
        <h3 className="mt-4 text-lg font-semibold">No documents yet</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Document management will be available in Phase 1.
        </p>
      </div>
    </div>
  )
}
