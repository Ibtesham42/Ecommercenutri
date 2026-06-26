import { Skeleton } from "@/components/ui/skeleton";
import { ProductGridSkeleton } from "@/components/storefront/skeletons";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8">
      <Skeleton className="mb-6 h-9 w-40" />
      <Skeleton className="mb-8 h-11 w-full max-w-xl" />
      <ProductGridSkeleton count={8} />
    </div>
  );
}
