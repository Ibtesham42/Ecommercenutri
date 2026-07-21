import { JNV_CONTAINER, JNV_CARD_GRID } from "@/lib/jnv/ui";

export default function JnvFolderLoading() {
  return (
    <div className="py-8 sm:py-10 2xl:py-14">
      <div className={JNV_CONTAINER}>
        <div className="h-4 w-56 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-3 h-8 w-64 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
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
