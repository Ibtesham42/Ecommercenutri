import Link from "next/link";
import { Home, ChevronRight } from "lucide-react";
import { jnvClassLabel } from "@/lib/jnv/catalog";

export function JnvBreadcrumbs({
  classLevel,
  trail,
}: {
  classLevel: number;
  trail: { id: string; name: string }[];
}) {
  return (
    <nav aria-label="Breadcrumb" className="mb-4 flex flex-wrap items-center gap-1 text-sm">
      <Link
        href="/jnv"
        className="flex items-center gap-1 rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <Home className="size-3.5" />
      </Link>
      <ChevronRight className="size-3.5 text-slate-300 dark:text-slate-600" />
      <Link
        href={`/jnv/class/${classLevel}`}
        className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        {jnvClassLabel(classLevel)}
      </Link>
      {trail.map((f, i) => (
        <span key={f.id} className="flex items-center gap-1">
          <ChevronRight className="size-3.5 text-slate-300 dark:text-slate-600" />
          {i === trail.length - 1 ? (
            <span className="rounded px-1.5 py-0.5 font-medium text-slate-900 dark:text-slate-100">{f.name}</span>
          ) : (
            <Link
              href={`/jnv/class/${classLevel}/folder/${f.id}`}
              className="rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              {f.name}
            </Link>
          )}
        </span>
      ))}
    </nav>
  );
}
