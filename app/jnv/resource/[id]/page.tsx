import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getJnvResourceById, getJnvBreadcrumbs } from "@/lib/queries/jnv";
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

  const breadcrumbs = await getJnvBreadcrumbs(resource.folderId);

  return (
    <div className="py-8 sm:py-10">
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <JnvBreadcrumbs
          classLevel={resource.classLevel}
          trail={breadcrumbs.map((f) => ({ id: f.id, name: f.name }))}
        />
        <ResourceViewer
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
