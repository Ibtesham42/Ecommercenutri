export default function JnvResourceLoading() {
  return (
    <div className="py-8 sm:py-10 2xl:py-14">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 2xl:max-w-[1500px] 2xl:px-12">
        <div className="h-4 w-64 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-4 h-7 w-72 max-w-full animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
        <div className="mt-2 h-4 w-52 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
        <div className="mt-4 h-[60vh] animate-pulse rounded-2xl border border-slate-200 bg-slate-100 dark:border-slate-800 dark:bg-slate-900" />
        <div className="mt-4 flex flex-wrap gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 w-24 animate-pulse rounded-lg bg-slate-200 dark:bg-slate-800" />
          ))}
        </div>
      </div>
    </div>
  );
}
