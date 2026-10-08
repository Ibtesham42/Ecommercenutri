import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="shop-container pt-10 pb-24 sm:pt-14">
      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col items-center text-center">
          <Skeleton className="size-14 rounded-full" />
          <Skeleton className="mt-6 h-3 w-28" />
          <Skeleton className="mt-3 h-10 w-64" />
          <Skeleton className="mt-3 h-4 w-72" />
        </div>
        <Skeleton className="mt-8 h-12 w-full rounded-xl" />
        <Skeleton className="mt-6 h-64 w-full rounded-xl" />
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Skeleton className="h-12 w-full rounded-lg sm:flex-1" />
          <Skeleton className="h-12 w-full rounded-lg sm:flex-1" />
        </div>
      </div>
    </div>
  );
}
