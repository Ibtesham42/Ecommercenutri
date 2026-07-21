import type { Metadata } from "next";
import { searchJnvResources } from "@/lib/queries/jnv";
import { isJnvClassLevel } from "@/lib/jnv/catalog";
import { JnvSearchForm } from "@/components/jnv/jnv-search-form";
import { ResourceCard } from "@/components/jnv/resource-card";
import { JNV_CONTAINER_NARROW, JNV_CARD_GRID } from "@/lib/jnv/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Search" };

export default async function JnvSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; class?: string; kind?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const classNum = Number(sp.class);
  const classLevel = isJnvClassLevel(classNum) ? classNum : undefined;
  const kind = sp.kind ?? "";
  const hasQuery = Boolean(q || classLevel || kind);

  const results = hasQuery
    ? await searchJnvResources({ query: q || undefined, classLevel, fileKind: kind || undefined })
    : [];

  return (
    <div className="py-8 sm:py-10 2xl:py-14">
      <div className={JNV_CONTAINER_NARROW}>
        <h1 className="mb-4 text-2xl font-bold tracking-tight sm:text-3xl 3xl:text-4xl">Search resources</h1>
        <JnvSearchForm initial={{ q, classLevel: classLevel ? String(classLevel) : "", kind }} />

        <div className="mt-8">
          {!hasQuery ? (
            <p className="text-sm text-slate-400">
              Search by class, subject, filename, keyword or teacher.
            </p>
          ) : results.length === 0 ? (
            <p className="text-sm text-slate-400">No resources matched your search.</p>
          ) : (
            <>
              <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
                {results.length} result{results.length === 1 ? "" : "s"}
              </p>
              <div className={JNV_CARD_GRID}>
                {results.map((r) => (
                  <ResourceCard
                    key={r.id}
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
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
