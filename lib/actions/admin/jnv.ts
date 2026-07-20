"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { destroyAssetByUrl } from "@/lib/cloudinary";
import {
  jnvAnnouncementSchema,
  jnvFolderCreateSchema,
  jnvFolderMoveSchema,
  jnvFolderUpdateSchema,
  jnvResourceCreateSchema,
  jnvResourceUpdateSchema,
} from "@/lib/validations/jnv";
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";

function revalidate() {
  revalidatePath("/admin/jnv");
  revalidatePath("/jnv", "layout");
}

/** All descendant folder ids of `folderId` (not including itself), via BFS. */
async function descendantFolderIds(folderId: string): Promise<string[]> {
  const all: string[] = [];
  let frontier = [folderId];
  while (frontier.length > 0) {
    const children = await prisma.jnvFolder.findMany({
      where: { parentId: { in: frontier } },
      select: { id: true },
    });
    const ids = children.map((c) => c.id);
    all.push(...ids);
    frontier = ids;
  }
  return all;
}

// Folders --------------------------------------------------------------------

export async function createJnvFolder(input: unknown): Promise<AdminResult<{ id: string }>> {
  const admin = await requirePermission("jnv");
  const parsed = jnvFolderCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid folder." };
  }
  const d = parsed.data;

  if (d.parentId) {
    const parent = await prisma.jnvFolder.findUnique({
      where: { id: d.parentId },
      select: { classLevel: true },
    });
    if (!parent) return { ok: false, error: "Parent folder not found." };
    if (parent.classLevel !== d.classLevel) {
      return { ok: false, error: "Folder must stay within the same class." };
    }
  }

  const max = await prisma.jnvFolder.aggregate({
    where: { parentId: d.parentId ?? null, classLevel: d.classLevel },
    _max: { order: true },
  });

  const folder = await prisma.jnvFolder.create({
    data: {
      classLevel: d.classLevel,
      name: d.name,
      icon: d.icon || null,
      parentId: d.parentId ?? null,
      order: (max._max.order ?? -1) + 1,
      createdById: admin.id,
    },
    select: { id: true },
  });
  revalidate();
  return { ok: true, data: { id: folder.id } };
}

export async function updateJnvFolder(input: unknown): Promise<AdminResult> {
  await requirePermission("jnv");
  const parsed = jnvFolderUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid folder." };
  }
  const d = parsed.data;
  await prisma.jnvFolder.update({
    where: { id: d.id },
    data: { name: d.name, icon: d.icon || null },
  });
  revalidate();
  return { ok: true };
}

export async function moveJnvFolder(input: unknown): Promise<AdminResult> {
  await requirePermission("jnv");
  const parsed = jnvFolderMoveSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid move." };
  }
  const d = parsed.data;
  if (d.parentId === d.id) return { ok: false, error: "A folder can't be its own parent." };

  const folder = await prisma.jnvFolder.findUnique({
    where: { id: d.id },
    select: { classLevel: true },
  });
  if (!folder) return { ok: false, error: "Folder not found." };

  if (d.parentId) {
    const descendants = await descendantFolderIds(d.id);
    if (descendants.includes(d.parentId)) {
      return { ok: false, error: "Can't move a folder into its own subfolder." };
    }
    const parent = await prisma.jnvFolder.findUnique({
      where: { id: d.parentId },
      select: { classLevel: true },
    });
    if (!parent || parent.classLevel !== folder.classLevel) {
      return { ok: false, error: "Folder must stay within the same class." };
    }
  }

  const max = await prisma.jnvFolder.aggregate({
    where: { parentId: d.parentId, classLevel: folder.classLevel },
    _max: { order: true },
  });
  await prisma.jnvFolder.update({
    where: { id: d.id },
    data: { parentId: d.parentId, order: (max._max.order ?? -1) + 1 },
  });
  revalidate();
  return { ok: true };
}

/** Persist a new sibling order for drag-and-drop reordering within one parent. */
export async function reorderJnvFolders(ids: string[]): Promise<AdminResult> {
  await requirePermission("jnv");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: true };
  await prisma.$transaction(
    ids.map((id, index) => prisma.jnvFolder.update({ where: { id }, data: { order: index } })),
  );
  revalidate();
  return { ok: true };
}

export async function deleteJnvFolder(id: string): Promise<AdminResult> {
  await requirePermission("jnv");
  const folder = await prisma.jnvFolder.findUnique({ where: { id }, select: { id: true } });
  if (!folder) return { ok: false, error: "Folder not found." };

  const allIds = [id, ...(await descendantFolderIds(id))];
  const resources = await prisma.jnvResource.findMany({
    where: { folderId: { in: allIds } },
    select: { fileUrl: true, thumbnailUrl: true },
  });

  // DB cascade removes the folder tree + its resources; Cloudinary cleanup
  // best-effort after (DB is the source of truth for what's "deleted").
  await prisma.jnvFolder.delete({ where: { id } });
  for (const r of resources) {
    await destroyAssetByUrl(r.fileUrl);
    if (r.thumbnailUrl) await destroyAssetByUrl(r.thumbnailUrl);
  }
  revalidate();
  return { ok: true };
}

// Resources --------------------------------------------------------------------

export async function createJnvResource(input: unknown): Promise<AdminResult<{ id: string }>> {
  const admin = await requirePermission("jnv");
  const parsed = jnvResourceCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid resource." };
  }
  const d = parsed.data;

  const folder = await prisma.jnvFolder.findUnique({
    where: { id: d.folderId },
    select: { classLevel: true },
  });
  if (!folder) return { ok: false, error: "Folder not found." };

  const resource = await prisma.jnvResource.create({
    data: {
      folderId: d.folderId,
      classLevel: folder.classLevel,
      subject: d.subject || null,
      title: d.title,
      description: d.description || null,
      teacherName: d.teacherName || null,
      fileUrl: d.fileUrl,
      fileKind: d.fileKind,
      mimeType: d.mimeType || null,
      fileSize: d.fileSize,
      thumbnailUrl: d.thumbnailUrl || null,
      isAssignment: d.isAssignment,
      dueAt: d.dueAt ?? null,
      uploadedById: admin.id,
    },
    select: { id: true },
  });
  revalidate();
  return { ok: true, data: { id: resource.id } };
}

export async function updateJnvResource(input: unknown): Promise<AdminResult> {
  await requirePermission("jnv");
  const parsed = jnvResourceUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid resource." };
  }
  const d = parsed.data;

  let classLevel: number | undefined;
  if (d.folderId) {
    const folder = await prisma.jnvFolder.findUnique({
      where: { id: d.folderId },
      select: { classLevel: true },
    });
    if (!folder) return { ok: false, error: "Folder not found." };
    classLevel = folder.classLevel;
  }

  await prisma.jnvResource.update({
    where: { id: d.id },
    data: {
      ...(d.folderId ? { folderId: d.folderId, classLevel } : {}),
      subject: d.subject || null,
      title: d.title,
      description: d.description || null,
      teacherName: d.teacherName || null,
      isAssignment: d.isAssignment,
      dueAt: d.dueAt ?? null,
    },
  });
  revalidate();
  return { ok: true };
}

export async function deleteJnvResource(id: string): Promise<AdminResult> {
  await requirePermission("jnv");
  const resource = await prisma.jnvResource.findUnique({
    where: { id },
    select: { fileUrl: true, thumbnailUrl: true },
  });
  if (!resource) return { ok: false, error: "Resource not found." };
  await prisma.jnvResource.delete({ where: { id } });
  await destroyAssetByUrl(resource.fileUrl);
  if (resource.thumbnailUrl) await destroyAssetByUrl(resource.thumbnailUrl);
  revalidate();
  return { ok: true };
}

const RESOURCE_BULK_ACTIONS = ["delete"] as const;
type ResourceBulkAction = (typeof RESOURCE_BULK_ACTIONS)[number];

export async function bulkJnvResourceAction(
  ids: string[],
  action: ResourceBulkAction,
): Promise<AdminResult<BulkOutcome>> {
  await requirePermission("jnv");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." };
  if (!RESOURCE_BULK_ACTIONS.includes(action)) return { ok: false, error: "Unknown action." };

  const doomed = await prisma.jnvResource.findMany({
    where: { id: { in: ids } },
    select: { fileUrl: true, thumbnailUrl: true },
  });
  const res = await prisma.jnvResource.deleteMany({ where: { id: { in: ids } } });
  for (const r of doomed) {
    await destroyAssetByUrl(r.fileUrl);
    if (r.thumbnailUrl) await destroyAssetByUrl(r.thumbnailUrl);
  }
  revalidate();
  return { ok: true, data: { done: res.count, skipped: ids.length - res.count } };
}

// Announcements ----------------------------------------------------------------

export async function saveJnvAnnouncement(input: unknown): Promise<AdminResult> {
  const admin = await requirePermission("jnv");
  const parsed = jnvAnnouncementSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid announcement." };
  }
  const d = parsed.data;
  const data = {
    title: d.title,
    body: d.body,
    classLevel: d.classLevel ?? null,
    pinned: d.pinned,
  };
  if (d.id) {
    await prisma.jnvAnnouncement.update({ where: { id: d.id }, data });
  } else {
    await prisma.jnvAnnouncement.create({ data: { ...data, createdById: admin.id } });
  }
  revalidate();
  return { ok: true };
}

export async function toggleJnvAnnouncementPin(id: string, pinned: boolean): Promise<AdminResult> {
  await requirePermission("jnv");
  await prisma.jnvAnnouncement.update({ where: { id }, data: { pinned } });
  revalidate();
  return { ok: true };
}

export async function deleteJnvAnnouncement(id: string): Promise<AdminResult> {
  await requirePermission("jnv");
  await prisma.jnvAnnouncement.delete({ where: { id } });
  revalidate();
  return { ok: true };
}
