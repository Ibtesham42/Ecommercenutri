import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <Skeleton className="mb-6 h-8 w-40 sm:h-9 sm:w-48" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex gap-4 rounded-2xl border bg-card p-3 shadow-elev-1 sm:p-4">
              <Skeleton className="size-24 shrink-0 rounded-xl" />
              <div className="flex flex-1 flex-col justify-between py-1">
                <div className="space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
                <div className="flex items-center justify-between">
                  <Skeleton className="h-9 w-24 rounded-xl" />
                  <Skeleton className="h-5 w-16" />
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="h-fit space-y-4 rounded-2xl border bg-card p-5 shadow-elev-1">
          <Skeleton className="h-5 w-32" />
          <div className="space-y-2.5">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
          <Skeleton className="h-13 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
