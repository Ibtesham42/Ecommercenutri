import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="shop-container pt-6 pb-28 sm:pt-8 lg:pb-24">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="mt-3 mb-5 h-9 w-40 sm:mb-6 sm:h-11 sm:w-52" />
      <Skeleton className="h-11 w-full max-w-xl" />
      <div className="mt-8 grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-12 xl:gap-16">
        <div className="space-y-10 lg:space-y-12">
          <div>
            <Skeleton className="mb-4 h-7 w-48" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-32 rounded-xl" />
              <Skeleton className="h-32 rounded-xl max-sm:hidden" />
            </div>
          </div>
          <div>
            <Skeleton className="mb-4 h-7 w-44" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          </div>
        </div>
        <div className="h-fit space-y-4 rounded-xl border border-border bg-card p-5 sm:p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-11 w-full rounded-lg" />
          <div className="space-y-3 border-t border-border pt-5">
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
