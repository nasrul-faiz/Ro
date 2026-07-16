import { AppLayout } from "@/components/app-layout"
import { Skeleton } from "@/components/ui/skeleton"

export default function HomeLoading() {
  return (
    <AppLayout title="Route List" defaultSidebarOpen={false}>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap gap-2">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-8 w-24 rounded-md" />
            ))}
          </div>
          <div className="mt-4 flex flex-col gap-2">
            <Skeleton className="h-4 w-16" />
            <Skeleton className="h-10 w-full max-w-xl" />
          </div>
        </div>

        <div className="rounded-xl border bg-card p-4">
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full" />
            ))}
          </div>
        </div>
      </div>
    </AppLayout>
  )
}