import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { PRODUCT_GRID_CLASS } from "@/lib/product-card";

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
