import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="flex flex-col items-center text-center">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="mt-5 h-8 w-64" />
        <Skeleton className="mt-2 h-4 w-72" />
      </div>
      <Skeleton className="mt-6 h-11 w-full rounded-2xl" />
      <Skeleton className="mt-8 h-48 w-full rounded-2xl" />
      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Skeleton className="h-10 w-full sm:w-36" />
        <Skeleton className="h-10 w-full sm:w-36" />
      </div>
    </div>
  );
}
