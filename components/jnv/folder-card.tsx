import Link from "next/link";
import { Folder, FileStack } from "lucide-react";
import { formatDate } from "@/lib/format";

export function FolderCard({
  id,
  classLevel,
  name,
  childCount,
  resourceCount,
  updatedAt,
}: {
  id: string;
  classLevel: number;
  name: string;
  childCount: number;
  resourceCount: number;
  updatedAt: Date | string;
}) {
  return (
    <Link
      href={`/jnv/class/${classLevel}/folder/${id}`}
      className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-all motion-safe:duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700"
    >
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-blue-600/10 text-blue-700 dark:bg-blue-400/10 dark:text-blue-400">
        <Folder className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-base font-semibold">{name}</span>
        <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
          <FileStack className="size-3.5" />
          {childCount > 0 ? `${childCount} folders, ` : ""}
          {resourceCount} file{resourceCount === 1 ? "" : "s"}
        </span>
        <span className="mt-1 block text-xs text-slate-400 dark:text-slate-500">
          Updated {formatDate(updatedAt)}
        </span>
      </span>
    </Link>
  );
}
