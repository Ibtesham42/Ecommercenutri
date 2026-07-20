import Link from "next/link";
import { ArrowRight, FolderOpen, FileStack } from "lucide-react";
import { jnvClassLabel } from "@/lib/jnv/catalog";
import { formatDate } from "@/lib/format";

// Deterministic per-class accent so the 5 cards read as a set, not identical
// blue tiles — cycles through the academic blue/emerald palette.
const ACCENTS = [
  "from-blue-600 to-blue-700",
  "from-emerald-600 to-emerald-700",
  "from-blue-700 to-indigo-700",
  "from-emerald-700 to-teal-700",
  "from-indigo-600 to-blue-700",
];

export function ClassCard({
  classLevel,
  index,
  folderCount,
  resourceCount,
  lastUpdated,
}: {
  classLevel: number;
  index: number;
  folderCount: number;
  resourceCount: number;
  lastUpdated: Date | string | null;
}) {
  return (
    <Link
      href={`/jnv/class/${classLevel}`}
      className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition-all motion-safe:duration-200 hover:-translate-y-0.5 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
    >
      <div
        className={`absolute -right-8 -top-8 size-28 rounded-full bg-gradient-to-br opacity-10 ${ACCENTS[index % ACCENTS.length]}`}
      />
      <p className="text-2xl font-bold tracking-tight sm:text-3xl">{jnvClassLabel(classLevel)}</p>
      <div className="mt-4 flex items-center gap-4 text-sm text-slate-500 dark:text-slate-400">
        <span className="flex items-center gap-1.5">
          <FolderOpen className="size-4" /> {folderCount}
        </span>
        <span className="flex items-center gap-1.5">
          <FileStack className="size-4" /> {resourceCount}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
        {lastUpdated ? `Updated ${formatDate(lastUpdated)}` : "No resources yet"}
      </p>
      <span className="mt-4 flex items-center gap-1 text-sm font-semibold text-blue-700 motion-safe:transition-transform motion-safe:group-hover:translate-x-1 dark:text-blue-400">
        Open class <ArrowRight className="size-4" />
      </span>
    </Link>
  );
}
