import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <Skeleton className="mb-6 h-8 w-32 sm:h-9 sm:w-40" />
      <Skeleton className="mb-6 h-7 w-full max-w-sm" />
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <div>
            <Skeleton className="mb-3 h-5 w-36" />
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-24 rounded-xl" />
              <Skeleton className="h-24 rounded-xl" />
            </div>
          </div>
          <div>
            <Skeleton className="mb-3 h-5 w-32" />
            <div className="space-y-3">
              <Skeleton className="h-20 rounded-xl" />
              <Skeleton className="h-20 rounded-xl" />
            </div>
          </div>
        </div>
        <div className="h-fit space-y-4 rounded-2xl border p-5 shadow-elev-1">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="space-y-2.5 border-t pt-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-6 w-full" />
          </div>
          <div className="space-y-2.5 border-t pt-4">
            <Skeleton className="h-16 w-full rounded-xl" />
            <Skeleton className="h-16 w-full rounded-xl" />
          </div>
          <Skeleton className="h-13 w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}
