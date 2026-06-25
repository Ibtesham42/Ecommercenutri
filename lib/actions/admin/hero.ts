"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { heroSlideSchema } from "@/lib/validations/admin";
import type { AdminResult } from "@/lib/actions/admin/types";

function revalidate() {
  revalidatePath("/admin/hero");
  revalidatePath("/", "layout"); // homepage renders the slider
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

  const data = {
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
    await prisma.heroSlide.update({ where: { id: d.id }, data });
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
  await prisma.heroSlide.delete({ where: { id } });
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
