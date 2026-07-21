import type { ComponentType } from "react";
import { ResourceCard } from "@/components/jnv/resource-card";
import type { JnvResourceRow } from "@/lib/queries/jnv";

/** Horizontal-scrolling "Most Downloaded" / "Recently Added" style rail. */
export function JnvResourceRail({
  title,
  icon: Icon,
  resources,
}: {
  title: string;
  icon: ComponentType<{ className?: string }>;
  resources: JnvResourceRow[];
}) {
  if (resources.length === 0) return null;
  return (
    <div className="mt-8">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-slate-600 dark:text-slate-300 3xl:text-base">
        <Icon className="size-4" /> {title}
      </h2>
      <div className="no-scrollbar -mx-1 flex snap-x gap-4 overflow-x-auto px-1 pb-1">
        {resources.map((r) => (
          <div key={r.id} className="w-72 shrink-0 snap-start">
            <ResourceCard
              id={r.id}
              title={r.title}
              subject={r.subject}
              teacherName={r.teacherName}
              fileKind={r.fileKind}
              fileSize={r.fileSize}
              isAssignment={r.isAssignment}
              dueAt={r.dueAt}
              downloadCount={r.downloadCount}
              createdAt={r.createdAt}
            />
          </div>
        ))}
      </div>
    </div>
  );
}
