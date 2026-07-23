import { prisma } from "@/lib/prisma";
import type { JnvClassLevel } from "@/lib/jnv/catalog";
import { cached, cacheDel } from "@/lib/redis";

/** One-shot retry: Neon scales to zero and the first query after idle can throw
 *  P1001 — retrying once warms the connection back up. */
async function withRetry<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error("[jnv] query failed, retrying once:", err);
    await new Promise((r) => setTimeout(r, 400));
    return fn();
  }
}

// Short-TTL Redis cache for hot reads (folder listings, resource metadata) —
// classroom navigation re-requests the same folder/resource repeatedly
// (teacher flipping back and forth during a lesson). Redis round-trips
// through JSON, which turns Date fields into strings on a cache hit, so
// every cached read is revived back into real Date objects below —
// otherwise `.toISOString()` calls downstream (e.g. the resource page) would
// throw on a cache hit. TTLs are short enough that a missed invalidation
// self-heals quickly rather than needing to be perfectly exhaustive.
const folderKey = (id: string) => `jnv:folder:${id}`;
const folderListKey = (classLevel: number, parentId: string | null) =>
  `jnv:folders:${classLevel}:${parentId ?? "root"}`;
const resourceKey = (id: string) => `jnv:resource:${id}`;
const resourcesInFolderKey = (folderId: string) => `jnv:resources-in-folder:${folderId}`;

function reviveFolder<T extends { updatedAt: Date | string } | null>(f: T): T {
  if (!f) return f;
  return { ...f, updatedAt: new Date(f.updatedAt) };
}
function reviveFolderList<T extends { updatedAt: Date | string }>(list: T[]): T[] {
  return list.map((f) => ({ ...f, updatedAt: new Date(f.updatedAt) }));
}
function reviveResource<
  T extends { createdAt: Date | string; updatedAt: Date | string; dueAt: Date | string | null },
>(r: T): T {
  return {
    ...r,
    createdAt: new Date(r.createdAt),
    updatedAt: new Date(r.updatedAt),
    dueAt: r.dueAt ? new Date(r.dueAt) : null,
  };
}
function reviveResourceList<
  T extends { createdAt: Date | string; updatedAt: Date | string; dueAt: Date | string | null },
>(list: T[]): T[] {
  return list.map(reviveResource);
}

/** Invalidate a folder's own cache entry and (when known) the listing it
 *  appears in. Call after any write that changes a folder's name/icon/order
 *  or its parent/class. */
export function invalidateJnvFolder(
  id: string,
  classLevel?: number,
  parentId?: string | null,
): Promise<void> {
  const keys = [folderKey(id)];
  if (classLevel !== undefined) keys.push(folderListKey(classLevel, parentId ?? null));
  return cacheDel(...keys);
}

/** Invalidate a resource's own cache entry and (when known) the folder
 *  listing it belongs to. Call after any resource create/update/delete. */
export function invalidateJnvResource(id: string, folderId?: string): Promise<void> {
  const keys = [resourceKey(id)];
  if (folderId) keys.push(resourcesInFolderKey(folderId));
  return cacheDel(...keys);
}

export type JnvFolderNode = {
  id: string;
  classLevel: number;
  name: string;
  icon: string | null;
  parentId: string | null;
  order: number;
  childCount: number;
  resourceCount: number;
  updatedAt: Date;
};

export type JnvResourceRow = {
  id: string;
  folderId: string;
  classLevel: number;
  subject: string | null;
  title: string;
  description: string | null;
  teacherName: string | null;
  fileUrl: string;
  fileKind: string;
  mimeType: string | null;
  fileSize: number;
  thumbnailUrl: string | null;
  isAssignment: boolean;
  dueAt: Date | null;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
  folderName: string;
};

const resourceSelect = {
  id: true,
  folderId: true,
  classLevel: true,
  subject: true,
  title: true,
  description: true,
  teacherName: true,
  fileUrl: true,
  fileKind: true,
  mimeType: true,
  fileSize: true,
  thumbnailUrl: true,
  isAssignment: true,
  dueAt: true,
  downloadCount: true,
  createdAt: true,
  updatedAt: true,
  folder: { select: { name: true } },
} as const;

function toResourceRow(r: {
  id: string;
  folderId: string;
  classLevel: number;
  subject: string | null;
  title: string;
  description: string | null;
  teacherName: string | null;
  fileUrl: string;
  fileKind: string;
  mimeType: string | null;
  fileSize: number;
  thumbnailUrl: string | null;
  isAssignment: boolean;
  dueAt: Date | null;
  downloadCount: number;
  createdAt: Date;
  updatedAt: Date;
  folder: { name: string };
}): JnvResourceRow {
  return { ...r, folderName: r.folder.name };
}

/** Root + subfolders directly under `parentId` (null = class root) for one class. */
export async function getJnvFolders(
  classLevel: number,
  parentId: string | null,
): Promise<JnvFolderNode[]> {
  const list = await cached(folderListKey(classLevel, parentId), 60, () =>
    withRetry(async () => {
      const folders = await prisma.jnvFolder.findMany({
        where: { classLevel, parentId },
        orderBy: { order: "asc" },
        include: { _count: { select: { children: true, resources: true } } },
      });
      return folders.map((f) => ({
        id: f.id,
        classLevel: f.classLevel,
        name: f.name,
        icon: f.icon,
        parentId: f.parentId,
        order: f.order,
        childCount: f._count.children,
        resourceCount: f._count.resources,
        updatedAt: f.updatedAt,
      }));
    }),
  );
  return reviveFolderList(list);
}

export async function getJnvFolderById(id: string): Promise<JnvFolderNode | null> {
  const f = await cached(folderKey(id), 300, () =>
    withRetry(async () => {
      const f = await prisma.jnvFolder.findUnique({
        where: { id },
        include: { _count: { select: { children: true, resources: true } } },
      });
      if (!f) return null;
      return {
        id: f.id,
        classLevel: f.classLevel,
        name: f.name,
        icon: f.icon,
        parentId: f.parentId,
        order: f.order,
        childCount: f._count.children,
        resourceCount: f._count.resources,
        updatedAt: f.updatedAt,
      };
    }),
  );
  return reviveFolder(f);
}

/** Ancestor chain root → this folder, for breadcrumbs. */
export async function getJnvBreadcrumbs(folderId: string): Promise<JnvFolderNode[]> {
  const trail: JnvFolderNode[] = [];
  let currentId: string | null = folderId;
  while (currentId) {
    const node: JnvFolderNode | null = await getJnvFolderById(currentId);
    if (!node) break;
    trail.unshift(node);
    currentId = node.parentId;
  }
  return trail;
}

export async function getJnvResourcesInFolder(folderId: string): Promise<JnvResourceRow[]> {
  const rows = await cached(resourcesInFolderKey(folderId), 60, () =>
    withRetry(async () => {
      const rows = await prisma.jnvResource.findMany({
        where: { folderId },
        orderBy: { createdAt: "desc" },
        select: resourceSelect,
      });
      return rows.map(toResourceRow);
    }),
  );
  return reviveResourceList(rows);
}

export async function getJnvResourceById(id: string): Promise<JnvResourceRow | null> {
  const r = await cached(resourceKey(id), 120, () =>
    withRetry(async () => {
      const r = await prisma.jnvResource.findUnique({ where: { id }, select: resourceSelect });
      return r ? toResourceRow(r) : null;
    }),
  );
  return r ? reviveResource(r) : null;
}

export type JnvClassSummary = {
  classLevel: number;
  folderCount: number;
  resourceCount: number;
  lastUpdated: Date | null;
};

/** Per-class counts for the student homepage / admin dashboard class cards. */
export async function getJnvClassSummaries(
  classLevels: readonly number[],
): Promise<JnvClassSummary[]> {
  return withRetry(async () => {
    const [folderCounts, resourceCounts, lastUploads] = await Promise.all([
      prisma.jnvFolder.groupBy({ by: ["classLevel"], _count: { _all: true } }),
      prisma.jnvResource.groupBy({ by: ["classLevel"], _count: { _all: true } }),
      prisma.jnvResource.groupBy({ by: ["classLevel"], _max: { createdAt: true } }),
    ]);
    const folderMap = new Map(folderCounts.map((f) => [f.classLevel, f._count._all]));
    const resourceMap = new Map(resourceCounts.map((r) => [r.classLevel, r._count._all]));
    const lastMap = new Map(lastUploads.map((l) => [l.classLevel, l._max.createdAt]));
    return classLevels.map((classLevel) => ({
      classLevel,
      folderCount: folderMap.get(classLevel) ?? 0,
      resourceCount: resourceMap.get(classLevel) ?? 0,
      lastUpdated: lastMap.get(classLevel) ?? null,
    }));
  });
}

export type JnvClassHighlights = {
  mostDownloaded: JnvResourceRow[];
  recentlyAdded: JnvResourceRow[];
  subjects: { subject: string; count: number }[];
};

/** Powers the "Most Downloaded" / "Recently Added" rails and subject-wise
 *  navigation chips on the class page — one combined query per class. */
export async function getJnvClassHighlights(classLevel: number): Promise<JnvClassHighlights> {
  return withRetry(async () => {
    const [mostDownloaded, recentlyAdded, subjectGroups] = await Promise.all([
      prisma.jnvResource.findMany({
        where: { classLevel, downloadCount: { gt: 0 } },
        orderBy: { downloadCount: "desc" },
        take: 6,
        select: resourceSelect,
      }),
      prisma.jnvResource.findMany({
        where: { classLevel },
        orderBy: { createdAt: "desc" },
        take: 6,
        select: resourceSelect,
      }),
      prisma.jnvResource.groupBy({
        by: ["subject"],
        where: { classLevel, subject: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { subject: "desc" } },
      }),
    ]);
    return {
      mostDownloaded: mostDownloaded.map(toResourceRow),
      recentlyAdded: recentlyAdded.map(toResourceRow),
      subjects: subjectGroups
        .filter((g) => g.subject)
        .map((g) => ({ subject: g.subject as string, count: g._count._all })),
    };
  });
}

export type JnvSearchFilters = {
  query?: string;
  classLevel?: JnvClassLevel;
  subject?: string;
  fileKind?: string;
  teacherName?: string;
};

export async function searchJnvResources(filters: JnvSearchFilters): Promise<JnvResourceRow[]> {
  return withRetry(async () => {
    const { query, classLevel, subject, fileKind, teacherName } = filters;
    const rows = await prisma.jnvResource.findMany({
      where: {
        ...(classLevel ? { classLevel } : {}),
        ...(subject ? { subject: { equals: subject, mode: "insensitive" } } : {}),
        ...(fileKind ? { fileKind: fileKind as never } : {}),
        ...(teacherName ? { teacherName: { contains: teacherName, mode: "insensitive" } } : {}),
        ...(query
          ? {
              OR: [
                { title: { contains: query, mode: "insensitive" } },
                { description: { contains: query, mode: "insensitive" } },
                { subject: { contains: query, mode: "insensitive" } },
                { teacherName: { contains: query, mode: "insensitive" } },
                { folder: { name: { contains: query, mode: "insensitive" } } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: resourceSelect,
    });
    return rows.map(toResourceRow);
  });
}

export type JnvAnnouncementRow = {
  id: string;
  title: string;
  body: string;
  classLevel: number | null;
  pinned: boolean;
  createdAt: Date;
  updatedAt: Date;
};

/** Announcements visible to a class: school-wide (classLevel null) + that class's own. */
export async function getJnvAnnouncements(classLevel?: number): Promise<JnvAnnouncementRow[]> {
  return withRetry(() =>
    prisma.jnvAnnouncement.findMany({
      where: classLevel ? { OR: [{ classLevel: null }, { classLevel }] } : {},
      orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    }),
  );
}

export type JnvDashboardStats = {
  folderCount: number;
  resourceCount: number;
  storageBytes: number;
  totalDownloads: number;
  announcementCount: number;
  recentResources: JnvResourceRow[];
};

export async function getJnvDashboardStats(): Promise<JnvDashboardStats> {
  return withRetry(async () => {
    const [folderCount, resourceCount, sums, announcementCount, recent] = await Promise.all([
      prisma.jnvFolder.count(),
      prisma.jnvResource.count(),
      prisma.jnvResource.aggregate({ _sum: { fileSize: true, downloadCount: true } }),
      prisma.jnvAnnouncement.count(),
      prisma.jnvResource.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        select: resourceSelect,
      }),
    ]);
    return {
      folderCount,
      resourceCount,
      storageBytes: sums._sum.fileSize ?? 0,
      totalDownloads: sums._sum.downloadCount ?? 0,
      announcementCount,
      recentResources: recent.map(toResourceRow),
    };
  });
}
