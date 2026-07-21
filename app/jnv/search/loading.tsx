import { JNV_CONTAINER_NARROW, JNV_CARD_GRID } from "@/lib/jnv/ui";

export default function JnvSearchLoading() {
  return (
    <div className="py-8 sm:py-10 2xl:py-14">
      <div className={JNV_CONTAINER_NARROW}>
        <div className="mb-4 h-8 w-48 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="h-12 w-full animate-pulse rounded-xl bg-slate-200 dark:bg-slate-800" />
        <div className={`mt-8 ${JNV_CARD_GRID}`}>
          {Array.from({ length: 6 }).map((_, i) => (
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
