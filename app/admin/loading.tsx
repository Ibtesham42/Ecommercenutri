import { Skeleton } from "@/components/ui/skeleton";

/**
 * Shown during every admin route transition (Next.js segment loading UI), so
 * navigation feels instant. A generic page-header + KPI + table shape that
 * matches most admin pages. Purely presentational.
 */
export default function AdminLoading() {
  return (
    <div className="animate-fade-up" aria-busy="true" aria-label="Loading">
      {/* Page header */}
      <div className="mb-6 flex items-end justify-between gap-3">
        <div className="space-y-2">
          <Skeleton className="h-7 w-44" />
          <Skeleton className="h-4 w-28" />
        </div>
        <Skeleton className="h-9 w-32 rounded-lg" />
      </div>

      {/* KPI / filter row */}
      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-background">
        <div className="flex items-center gap-4 border-b bg-muted/30 px-4 py-3">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-40" />
          <Skeleton className="ml-auto h-4 w-20" />
        </div>
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b px-4 py-3 last:border-0">
            <Skeleton className="size-9 shrink-0 rounded-lg" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/5" />
            </div>
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </div>
  );
}
