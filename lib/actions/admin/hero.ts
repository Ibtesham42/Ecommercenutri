"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { heroSlideSchema } from "@/lib/validations/admin";
import { destroyAssetByUrl, publicIdFromUrl } from "@/lib/cloudinary";
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";

function revalidate() {
  revalidatePath("/admin/hero");
  revalidatePath("/", "layout"); // homepage renders the slider
}

type SlideMedia = {
  videoUrl?: string | null;
  desktopImage?: string | null;
  mobileImage?: string | null;
  videoPoster?: string | null;
};

/** All media URLs a slide holds (the fields that point at storage). */
function mediaUrls(s: SlideMedia): string[] {
  return [s.videoUrl, s.desktopImage, s.mobileImage, s.videoPoster].filter(
    (u): u is string => !!u,
  );
}

/**
 * Complete storage cleanup for removed slide media. Destroys each Cloudinary
 * asset (original + every derived version + CDN-cached copies via invalidate)
 * — but only when no remaining hero slide still references the same asset
 * (duplicated slides share URLs). Best-effort by design: the DB record is the
 * source of truth and a failed destroy only logs an orphan warning.
 */
async function cleanupSlideMedia(urls: string[]): Promise<void> {
  // Dedup by public_id: a video and its derived poster share one asset.
  const targets = new Map<string, string>();
  for (const url of urls) {
    const id = publicIdFromUrl(url);
    if (id) targets.set(id, url);
  }
  if (targets.size === 0) return;

  // Which assets are still in use by any remaining slide?
  const remaining = await prisma.heroSlide.findMany({
    select: { videoUrl: true, desktopImage: true, mobileImage: true, videoPoster: true },
  });
  const inUse = new Set<string>();
  for (const s of remaining) {
    for (const url of mediaUrls(s)) {
      const id = publicIdFromUrl(url);
      if (id) inUse.add(id);
    }
  }

  for (const [id, url] of targets) {
    if (inUse.has(id)) continue;
    await destroyAssetByUrl(url);
  }
}

const HERO_BULK_ACTIONS = ["publish", "unpublish", "delete"] as const;
type HeroBulkAction = (typeof HERO_BULK_ACTIONS)[number];

/** Bulk publish / unpublish / delete hero slides. */
export async function bulkHeroAction(
  ids: string[],
  action: HeroBulkAction,
): Promise<AdminResult<BulkOutcome>> {
  await requirePermission("appearance");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." };
  if (!HERO_BULK_ACTIONS.includes(action)) return { ok: false, error: "Unknown action." };

  try {
    let done = 0;
    if (action === "delete") {
      const doomed = await prisma.heroSlide.findMany({
        where: { id: { in: ids } },
        select: { videoUrl: true, desktopImage: true, mobileImage: true, videoPoster: true },
      });
      const res = await prisma.heroSlide.deleteMany({ where: { id: { in: ids } } });
      done = res.count;
      // Storage cleanup after the DB delete (so the in-use check sees only survivors).
      await cleanupSlideMedia(doomed.flatMap(mediaUrls));
    } else {
      const res = await prisma.heroSlide.updateMany({
        where: { id: { in: ids } },
        data: { isActive: action === "publish" },
      });
      done = res.count;
    }
    revalidate();
    return { ok: true, data: { done, skipped: ids.length - done } };
  } catch (err) {
    console.error("[admin] bulkHeroAction failed:", err);
    return { ok: false, error: "Bulk action failed." };
  }
}

export async function saveHeroSlide(input: unknown): Promise<AdminResult> {
  await requirePermission("appearance");

  const parsed = heroSlideSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid slide." };
  }
  const d = parsed.data;

  if (d.startsAt && d.expiresAt && d.expiresAt <= d.startsAt) {
    return { ok: false, error: "Expiry must be after the publish date." };
  }

  // Json semantics: clear when the slide is no longer a video, replace when a
  // fresh upload provided metadata, otherwise leave the stored value untouched.
  const videoMeta =
    d.mediaType !== "VIDEO"
      ? Prisma.DbNull
      : d.videoMeta
        ? (d.videoMeta as Prisma.InputJsonValue)
        : undefined;

  const data = {
    mediaType: d.mediaType,
    videoUrl: d.mediaType === "VIDEO" ? d.videoUrl || null : null,
    videoPoster: d.mediaType === "VIDEO" ? d.videoPoster || null : null,
    videoQuality: d.videoQuality,
    videoMeta,
    title: d.title || null,
    subtitle: d.subtitle || null,
    description: d.description || null,
    desktopImage: d.desktopImage,
    mobileImage: d.mobileImage || null,
    ctaText: d.ctaText || null,
    ctaUrl: d.ctaUrl || null,
    productId: d.productId || null,
    categoryId: d.categoryId || null,
    overlay: d.overlay,
    buttonColor: d.buttonColor || null,
    textAlign: d.textAlign,
    isActive: d.isActive,
    startsAt: d.startsAt ?? null,
    expiresAt: d.expiresAt ?? null,
  };

  if (d.id) {
    const prev = await prisma.heroSlide.findUnique({
      where: { id: d.id },
      select: { videoUrl: true, desktopImage: true, mobileImage: true, videoPoster: true },
    });
    await prisma.heroSlide.update({ where: { id: d.id }, data });
    // Storage cleanup for any media the admin replaced or removed.
    if (prev) {
      const next = new Set(mediaUrls(data).map((u) => publicIdFromUrl(u) ?? u));
      const removed = mediaUrls(prev).filter((u) => !next.has(publicIdFromUrl(u) ?? u));
      if (removed.length > 0) await cleanupSlideMedia(removed);
    }
  } else {
    // New slides go to the end of the list.
    const max = await prisma.heroSlide.aggregate({ _max: { sortOrder: true } });
    await prisma.heroSlide.create({
      data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
  }
  revalidate();
  return { ok: true };
}

export async function toggleHeroSlide(id: string, isActive: boolean): Promise<AdminResult> {
  await requirePermission("appearance");
  await prisma.heroSlide.update({ where: { id }, data: { isActive } });
  revalidate();
  return { ok: true };
}

export async function duplicateHeroSlide(id: string): Promise<AdminResult> {
  await requirePermission("appearance");
  const src = await prisma.heroSlide.findUnique({ where: { id } });
  if (!src) return { ok: false, error: "Slide not found." };

  const max = await prisma.heroSlide.aggregate({ _max: { sortOrder: true } });
  // Clone everything except identity/ordering/timestamps; start unpublished.
  const { id: _id, createdAt: _c, updatedAt: _u, sortOrder: _s, ...rest } = src;
  void _id;
  void _c;
  void _u;
  void _s;
  await prisma.heroSlide.create({
    data: {
      ...rest,
      // Json columns need explicit null semantics when cloning.
      videoMeta: src.videoMeta === null ? Prisma.DbNull : (src.videoMeta as Prisma.InputJsonValue),
      title: src.title ? `${src.title} (copy)` : null,
      isActive: false,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidate();
  return { ok: true };
}

export async function deleteHeroSlide(id: string): Promise<AdminResult> {
  await requirePermission("appearance");
  const slide = await prisma.heroSlide.findUnique({
    where: { id },
    select: { videoUrl: true, desktopImage: true, mobileImage: true, videoPoster: true },
  });
  await prisma.heroSlide.delete({ where: { id } });
  // Complete storage cleanup: original + derived + CDN-cached (unless shared).
  if (slide) await cleanupSlideMedia(mediaUrls(slide));
  revalidate();
  return { ok: true };
}

/** Persist a new slide order from drag-and-drop (array of ids, top → bottom). */
export async function reorderHeroSlides(ids: string[]): Promise<AdminResult> {
  await requirePermission("appearance");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: true };

  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.heroSlide.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  revalidate();
  return { ok: true };
}
