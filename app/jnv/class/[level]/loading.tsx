import { JNV_CONTAINER, JNV_CARD_GRID } from "@/lib/jnv/ui";

export default function JnvClassLoading() {
  return (
    <div className="py-8 sm:py-10 2xl:py-14">
      <div className={JNV_CONTAINER}>
        <div className="h-4 w-40 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-3 h-8 w-56 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="mt-2 h-4 w-80 max-w-full animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-6 flex flex-wrap gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-7 w-24 animate-pulse rounded-full bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
        <div className={`mt-6 ${JNV_CARD_GRID}`}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900"
            />
          ))}
        </div>
      </div>
    </div>
  );
}
