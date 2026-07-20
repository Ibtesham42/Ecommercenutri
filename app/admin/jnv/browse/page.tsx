import type { Metadata } from "next";
import { isConfigured } from "@/lib/env";
import {
  getJnvFolders,
  getJnvBreadcrumbs,
  getJnvResourcesInFolder,
  searchJnvResources,
} from "@/lib/queries/jnv";
import { JNV_CLASS_LEVELS, JNV_FILE_KINDS, isJnvClassLevel, type JnvClassLevel } from "@/lib/jnv/catalog";
import { JnvBrowseManager } from "@/components/admin/jnv/jnv-browse-manager";

export const metadata: Metadata = { title: "JNV Smart Class — Classes & Resources", robots: { index: false } };

export default async function JnvBrowsePage({
  searchParams,
}: {
  searchParams: Promise<{ class?: string; folder?: string; kind?: string }>;
}) {
  const sp = await searchParams;
  const parsedClass = Number(sp.class);
  const classLevel: JnvClassLevel = isJnvClassLevel(parsedClass) ? parsedClass : JNV_CLASS_LEVELS[0];
  const folderId = sp.folder || null;
  const kind = sp.kind && (JNV_FILE_KINDS as readonly string[]).includes(sp.kind) ? sp.kind : null;

  const [folders, breadcrumbs, folderResources, kindResults] = await Promise.all([
    getJnvFolders(classLevel, folderId),
    folderId ? getJnvBreadcrumbs(folderId) : Promise.resolve([]),
    folderId && !kind ? getJnvResourcesInFolder(folderId) : Promise.resolve([]),
    kind ? searchJnvResources({ classLevel, fileKind: kind }) : Promise.resolve([]),
  ]);

  return (
    <JnvBrowseManager
      classLevel={classLevel}
      folderId={folderId}
      kind={kind}
      breadcrumbs={breadcrumbs.map((f) => ({ id: f.id, name: f.name }))}
      folders={(kind ? [] : folders).map((f) => ({ ...f, updatedAt: f.updatedAt.toISOString() }))}
      resources={(kind ? kindResults : folderResources).map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        dueAt: r.dueAt ? r.dueAt.toISOString() : null,
      }))}
      cloudinaryReady={isConfigured.cloudinary()}
    />
  );
}
