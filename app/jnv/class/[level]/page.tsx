import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isJnvClassLevel, jnvClassLabel } from "@/lib/jnv/catalog";
import { getJnvFolders, getJnvAnnouncements } from "@/lib/queries/jnv";
import { FolderCard } from "@/components/jnv/folder-card";
import { AnnouncementBanner } from "@/components/jnv/announcement-banner";
import { JnvBreadcrumbs } from "@/components/jnv/jnv-breadcrumbs";
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

  const [folders, announcements] = await Promise.all([
    getJnvFolders(classLevel, null),
    getJnvAnnouncements(classLevel).catch(() => []),
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
        {folders.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <p className="font-medium text-slate-600 dark:text-slate-300">
              No folders yet for {jnvClassLabel(classLevel)}
            </p>
            <p className="mt-1 text-sm text-slate-400">
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
      </div>
    </div>
  );
}
