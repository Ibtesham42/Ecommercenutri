import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="shop-container pt-6 pb-28 sm:pt-8 lg:pb-24">
      <Skeleton className="h-3 w-12" />
      <Skeleton className="mt-3 mb-6 h-9 w-44 sm:mb-8 sm:h-11 sm:w-56" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:gap-12 xl:gap-16">
        <div>
          <Skeleton className="mb-2 h-12 w-full rounded-xl" />
          <div className="divide-y divide-border border-b border-border">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-4 py-5 sm:gap-5">
                <Skeleton className="size-24 shrink-0 rounded-lg sm:size-28" />
                <div className="flex flex-1 flex-col justify-between">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3.5 w-1/3" />
                  </div>
                  <Skeleton className="h-11 w-32 rounded-lg" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="h-fit space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6">
          <Skeleton className="h-6 w-40" />
          <div className="space-y-3 pt-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    </div>
  );
}
