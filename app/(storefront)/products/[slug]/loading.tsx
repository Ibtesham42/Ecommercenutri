import { Skeleton } from "@/components/ui/skeleton";

/** Mirrors the PDP: breadcrumb, gallery (dots on mobile, thumbnails md+) and the buy box. */
export default function Loading() {
  return (
    <div className="shop-container pt-5 pb-28 sm:pt-7" aria-hidden>
      <Skeleton className="h-4 w-56" />
      <div className="mt-5 sm:mt-7 md:grid md:grid-cols-[minmax(0,1.08fr)_minmax(0,1fr)] md:items-start md:gap-8 lg:gap-14 xl:gap-20">
        <div>
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="mt-3 flex justify-center gap-1.5 md:hidden">
            <Skeleton className="h-1.5 w-5 rounded-full" />
            <Skeleton className="size-1.5 rounded-full" />
            <Skeleton className="size-1.5 rounded-full" />
          </div>
          <div className="mt-3 hidden gap-2.5 md:flex">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="size-[4.5rem] rounded-lg" />
            ))}
          </div>
        </div>
        <div className="mt-6 md:mt-0">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-3 h-9 w-4/5 sm:h-11" />
          <Skeleton className="mt-3 h-4 w-32" />
          <Skeleton className="mt-3 h-4 w-full max-w-md" />
          <Skeleton className="mt-6 h-9 w-48" />
          <Skeleton className="mt-6 h-4 w-28" />
          <div className="mt-2.5 flex gap-2">
            <Skeleton className="h-12 w-[6.5rem] rounded-lg" />
            <Skeleton className="h-12 w-[6.5rem] rounded-lg" />
          </div>
          <div className="mt-6 flex gap-2.5">
            <Skeleton className="h-12 w-[7.5rem] rounded-lg" />
            <Skeleton className="h-12 flex-1 rounded-lg" />
          </div>
          <div className="mt-2.5 flex gap-2.5">
            <Skeleton className="h-12 flex-1 rounded-lg" />
            <Skeleton className="size-12 rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
}
