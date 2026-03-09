import { Skeleton } from "@/components/ui/skeleton"

export default function DocumentDetailLoading() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {/* Back button + title */}
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-7 w-64" />
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Left column — metadata & actions */}
        <div className="flex flex-col gap-4">
          {/* Status + actions row */}
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-28 rounded-full" />
            <Skeleton className="h-8 w-36" />
          </div>

          {/* File info card */}
          <div className="rounded-lg border p-4">
            <Skeleton className="mb-3 h-5 w-24" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>

          {/* Extracted fields card */}
          <div className="rounded-lg border p-4">
            <Skeleton className="mb-3 h-5 w-36" />
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex flex-col gap-1">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-4 w-28" />
                </div>
              ))}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-9 w-24" />
          </div>
        </div>

        {/* Right column — file preview */}
        <div className="flex flex-col gap-3">
          <Skeleton className="aspect-[3/4] w-full rounded-lg" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>

      {/* Tabs area */}
      <div className="mt-2">
        <div className="flex gap-2 border-b pb-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="mt-4 flex flex-col gap-3">
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
          <Skeleton className="h-16 w-full rounded-md" />
        </div>
      </div>
    </div>
  )
}
