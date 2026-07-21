import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isJnvClassLevel } from "@/lib/jnv/catalog";
import { getJnvFolderById, getJnvBreadcrumbs, getJnvFolders, getJnvResourcesInFolder } from "@/lib/queries/jnv";
import { FolderCard } from "@/components/jnv/folder-card";
import { ResourceCard } from "@/components/jnv/resource-card";
import { JnvBreadcrumbs } from "@/components/jnv/jnv-breadcrumbs";
import { JNV_CONTAINER, JNV_CARD_GRID } from "@/lib/jnv/ui";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ level: string; folderId: string }>;
}): Promise<Metadata> {
  const { folderId } = await params;
  const folder = await getJnvFolderById(folderId).catch(() => null);
  return { title: folder?.name ?? "Folder" };
}

export default async function JnvFolderPage({
  params,
}: {
  params: Promise<{ level: string; folderId: string }>;
}) {
  const { level, folderId } = await params;
  const classLevel = Number(level);
  if (!isJnvClassLevel(classLevel)) notFound();

  const folder = await getJnvFolderById(folderId);
  if (!folder || folder.classLevel !== classLevel) notFound();

  const [breadcrumbs, children, resources] = await Promise.all([
    getJnvBreadcrumbs(folderId),
    getJnvFolders(classLevel, folderId),
    getJnvResourcesInFolder(folderId),
  ]);

  return (
    <div className="py-8 sm:py-10 2xl:py-14">
      <div className={JNV_CONTAINER}>
        <JnvBreadcrumbs classLevel={classLevel} trail={breadcrumbs.slice(0, -1).map((f) => ({ id: f.id, name: f.name }))} />
        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl 3xl:text-4xl">{folder.name}</h1>

        {children.length === 0 && resources.length === 0 ? (
          <div className="mt-6 rounded-2xl border border-dashed border-slate-300 p-10 text-center dark:border-slate-700">
            <p className="font-medium text-slate-600 dark:text-slate-300">This folder is empty</p>
            <p className="mt-1 text-sm text-slate-400">Check back later — your teacher may add resources soon.</p>
          </div>
        ) : (
          <>
            {children.length > 0 && (
              <div className={`mt-6 ${JNV_CARD_GRID}`}>
                {children.map((f) => (
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
            {resources.length > 0 && (
              <div className="mt-8">
                <h2 className="mb-3 text-sm font-semibold text-slate-600 dark:text-slate-300 3xl:text-base">Resources</h2>
                <div className={JNV_CARD_GRID}>
                  {resources.map((r) => (
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
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
