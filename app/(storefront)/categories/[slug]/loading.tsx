import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/components/storefront/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <Skeleton className="mb-6 h-28 w-full rounded-2xl" />
      <div className="mb-6 flex items-center justify-between border-b pb-4">
        <Skeleton className="h-5 w-28" />
        <Skeleton className="h-9 w-40" />
      </div>
      <ProductGridSkeleton count={8} />
    </div>
  );
}
