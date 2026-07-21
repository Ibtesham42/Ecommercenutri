import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FolderOpen, Download, Clock3 } from "lucide-react";
import { isJnvClassLevel, jnvClassLabel } from "@/lib/jnv/catalog";
import { getJnvFolders, getJnvAnnouncements, getJnvClassHighlights } from "@/lib/queries/jnv";
import { FolderCard } from "@/components/jnv/folder-card";
import { AnnouncementBanner } from "@/components/jnv/announcement-banner";
import { JnvBreadcrumbs } from "@/components/jnv/jnv-breadcrumbs";
import { JnvResourceRail } from "@/components/jnv/resource-rail";
import { JNV_CONTAINER, JNV_CARD_GRID } from "@/lib/jnv/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ level: string }>;
}): Promise<Metadata> {
  const { level } = await params;
  const n = Number(level);
  return { title: isJnvClassLevel(n) ? jnvClassLabel(n) : "Class" };
}

export default async function JnvClassPage({ params }: { params: Promise<{ level: string }> }) {
  const { level } = await params;
  const classLevel = Number(level);
  if (!isJnvClassLevel(classLevel)) notFound();

  const [folders, announcements, highlights] = await Promise.all([
    getJnvFolders(classLevel, null),
    getJnvAnnouncements(classLevel).catch(() => []),
    getJnvClassHighlights(classLevel),
  ]);
  const pinned = announcements.filter((a) => a.pinned);

  return (
    <div className="py-8 sm:py-10 2xl:py-14">
      <div className={JNV_CONTAINER}>
        <JnvBreadcrumbs classLevel={classLevel} trail={[]} />
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl 3xl:text-4xl">{jnvClassLabel(classLevel)}</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 3xl:text-base">
          Choose a subject folder to view notes, slides, PDFs, videos and assignments.
        </p>
      </div>

      <div className="mt-6">
        <AnnouncementBanner announcements={pinned} />
      </div>

      <div className={JNV_CONTAINER}>
        {highlights.subjects.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2">
            {highlights.subjects.map((s) => (
              <Link
                key={s.subject}
                href={`/jnv/search?class=${classLevel}&subject=${encodeURIComponent(s.subject)}`}
                className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:border-blue-300 hover:text-blue-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-blue-700 dark:hover:text-blue-300"
              >
                {s.subject}
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800">
                  {s.count}
                </span>
              </Link>
            ))}
          </div>
        )}

        {folders.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <span className="grid size-12 place-items-center rounded-2xl bg-slate-100 text-slate-500 dark:bg-slate-800">
              <FolderOpen className="size-6" />
            </span>
            <p className="font-medium text-slate-600 dark:text-slate-300">
              No folders yet for {jnvClassLabel(classLevel)}
            </p>
            <p className="text-sm text-slate-500">
              Your teacher will add subjects and resources here soon.
            </p>
          </div>
        ) : (
          <div className={JNV_CARD_GRID}>
            {folders.map((f) => (
              <FolderCard
                key={f.id}
                id={f.id}
                classLevel={classLevel}
                name={f.name}
                childCount={f.childCount}
                resourceCount={f.resourceCount}
                updatedAt={f.updatedAt}
              />
            ))}
          </div>
        )}

        <JnvResourceRail title="Recently added" icon={Clock3} resources={highlights.recentlyAdded} />
        <JnvResourceRail title="Most downloaded" icon={Download} resources={highlights.mostDownloaded} />
      </div>
    </div>
  );
}
