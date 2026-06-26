import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/** A single product-card placeholder mirroring the real card's layout. */
export function ProductCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-3 w-1/3" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-3 w-2/5" />
        <Skeleton className="h-5 w-1/3" />
      </div>
    </div>
  );
}

/** A responsive grid of product-card skeletons (matches ProductGrid columns). */
export function ProductGridSkeleton({
  count = 8,
  className,
}: {
  count?: number;
  className?: string;
}) {
  return (
    <div className={cn("grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4", className)}>
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
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
