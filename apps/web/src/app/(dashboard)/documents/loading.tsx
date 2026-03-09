import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"

export default function DocumentsLoading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Skeleton className="h-9 w-32" />
          <Skeleton className="h-4 w-52 mt-2" />
        </div>
        <Skeleton className="h-9 w-36" />
      </div>

      {/* Filter bar skeleton */}
      <div className="flex flex-wrap gap-3">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-48" />
      </div>

      {/* Document card grid skeleton */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Card key={i} className="flex flex-col">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-2">
                <Skeleton className="h-8 w-8 rounded" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
              <Skeleton className="h-4 w-36 mt-2" />
            </CardHeader>
            <CardContent className="flex-1 pb-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-3 w-16 mt-1" />
            </CardContent>
            <CardFooter className="gap-2">
              <Skeleton className="h-8 flex-1" />
              <Skeleton className="h-8 w-8" />
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  )
}
