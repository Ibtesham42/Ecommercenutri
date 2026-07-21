import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getJnvResourceById, getJnvBreadcrumbs, getJnvResourcesInFolder } from "@/lib/queries/jnv";
import { JnvBreadcrumbs } from "@/components/jnv/jnv-breadcrumbs";
import { ResourceViewer } from "@/components/jnv/resource-viewer";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const resource = await getJnvResourceById(id).catch(() => null);
  return { title: resource?.title ?? "Resource" };
}

export default async function JnvResourcePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const resource = await getJnvResourceById(id);
  if (!resource) notFound();

  const [breadcrumbs, folderResources] = await Promise.all([
    getJnvBreadcrumbs(resource.folderId),
    getJnvResourcesInFolder(resource.folderId),
  ]);
  const siblings = folderResources.map((r) => ({ id: r.id, title: r.title }));

  return (
    <div className="py-8 sm:py-10 2xl:py-14">
      <div className="jnv-container mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 2xl:max-w-[1500px] 2xl:px-12">
        <JnvBreadcrumbs
          classLevel={resource.classLevel}
          trail={breadcrumbs.map((f) => ({ id: f.id, name: f.name }))}
        />
        <ResourceViewer
          siblings={siblings}
          resource={{
            id: resource.id,
            title: resource.title,
            description: resource.description,
            subject: resource.subject,
            teacherName: resource.teacherName,
            classLevel: resource.classLevel,
            fileUrl: resource.fileUrl,
            fileKind: resource.fileKind,
            fileSize: resource.fileSize,
            isAssignment: resource.isAssignment,
            dueAt: resource.dueAt ? resource.dueAt.toISOString() : null,
            downloadCount: resource.downloadCount,
            createdAt: resource.createdAt.toISOString(),
          }}
        />
      </div>
    </div>
  );
}
