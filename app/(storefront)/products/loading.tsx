import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/components/storefront/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <Skeleton className="mb-6 h-9 w-64" />
      <div className="mb-6 flex items-center justify-between border-b pb-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
        <aside className="hidden space-y-3 lg:block">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-full" />
          ))}
        </aside>
        <ProductGridSkeleton count={9} />
      </div>
    </div>
  );
}
