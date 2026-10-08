import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { CATALOG_GRID_CLASS, PRODUCT_GRID_CLASS } from "@/lib/product-card";

/** A single product-card placeholder mirroring the real card's layout. */
export function ProductCardSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="aspect-square w-full rounded-xl" />
      <div className="space-y-2 pt-3.5">
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-1/4" />
        <Skeleton className="mt-3 h-4 w-2/5" />
        <Skeleton className="mt-3 h-10 w-full rounded-lg" />
      </div>
    </div>
  );
}

/** A responsive grid of product-card skeletons (same container-query columns as ProductGrid). */
export function ProductGridSkeleton({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className="@container">
      <div className={cn(PRODUCT_GRID_CLASS, className)}>
        {Array.from({ length: count }).map((_, i) => (
          <ProductCardSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}

/** Loading state for a CatalogShell page: same container, header treatment,
 *  toolbar, sidebar and grid columns, so nothing jumps when content arrives. */
export function CatalogSkeleton({
  header = "plain",
  search = false,
}: {
  header?: "plain" | "split" | "panel";
  /** Search page: a search box under the title. */
  search?: boolean;
}) {
  const text = (
    <div className="space-y-3">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-10 w-3/5 max-w-sm sm:h-12" />
      <Skeleton className="h-4 w-4/5 max-w-lg" />
      {search && <Skeleton className="!mt-6 h-12 w-full max-w-xl rounded-full" />}
    </div>
  );
  return (
    <div className="shop-container pt-5 pb-16 sm:pt-7" aria-hidden>
      <Skeleton className="h-4 w-32" />
      <div className="mt-5 sm:mt-8">
        {header === "split" ? (
          <div className="grid grid-cols-[minmax(0,1fr)_5.5rem] items-start gap-4 sm:grid-cols-[minmax(0,1fr)_8rem] md:grid-cols-[minmax(0,1fr)_minmax(0,20rem)] md:items-center md:gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,24rem)] lg:gap-16">
            {text}
            <Skeleton className="aspect-square w-full rounded-lg md:aspect-[4/3] md:rounded-xl" />
          </div>
        ) : header === "panel" ? (
          <div className="rounded-xl bg-oat px-5 py-7 sm:px-8 sm:py-9 lg:px-10">{text}</div>
        ) : (
          text
        )}
      </div>
      <div className="mt-6 sm:mt-8 lg:mt-12 lg:grid lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10 xl:gap-14">
        <div className="hidden space-y-4 lg:block">
          <Skeleton className="h-6 w-20" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-3 border-b border-border pb-2.5 lg:pb-4">
            <Skeleton className="h-11 w-24 rounded-lg lg:hidden" />
            <Skeleton className="hidden h-4 w-36 sm:block" />
            <Skeleton className="ml-auto h-11 w-[9.75rem] rounded-lg sm:w-48 lg:h-10" />
          </div>
          <div className="mt-11 sm:mt-6">
            <ProductGridSkeleton count={8} className={CATALOG_GRID_CLASS} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Heading + grid skeleton for a homepage/section loading state. */
export function SectionSkeleton({ count = 4 }: { count?: number }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10">
      <div className="mb-8 space-y-2">
        <Skeleton className="h-7 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <ProductGridSkeleton count={count} />
    </div>
  );
}
