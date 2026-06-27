"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { showcaseItemSchema } from "@/lib/validations/admin";
import type { AdminResult } from "@/lib/actions/admin/types";

function revalidate() {
  revalidatePath("/admin/showcase");
  revalidatePath("/", "layout"); // homepage renders the showcase
}

export async function saveShowcaseItem(input: unknown): Promise<AdminResult> {
  await requirePermission("appearance");

  const parsed = showcaseItemSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid item." };
  }
  const d = parsed.data;

  const data = {
    title: d.title,
    tagline: d.tagline || null,
    image: d.image,
    imagePng: d.imagePng || null,
    productId: d.productId || null,
    ctaText: d.ctaText || null,
    ctaUrl: d.ctaUrl || null,
    animation: d.animation,
    background: d.background,
    rotationSpeed: d.rotationSpeed,
    floatIntensity: d.floatIntensity,
    zoom: d.zoom,
    isActive: d.isActive,
  };

  if (d.id) {
    await prisma.showcaseItem.update({ where: { id: d.id }, data });
  } else {
    const max = await prisma.showcaseItem.aggregate({ _max: { sortOrder: true } });
    await prisma.showcaseItem.create({
      data: { ...data, sortOrder: (max._max.sortOrder ?? 0) + 1 },
    });
  }
  revalidate();
  return { ok: true };
}

export async function toggleShowcaseItem(id: string, isActive: boolean): Promise<AdminResult> {
  await requirePermission("appearance");
  await prisma.showcaseItem.update({ where: { id }, data: { isActive } });
  revalidate();
  return { ok: true };
}

export async function duplicateShowcaseItem(id: string): Promise<AdminResult> {
  await requirePermission("appearance");
  const src = await prisma.showcaseItem.findUnique({ where: { id } });
  if (!src) return { ok: false, error: "Item not found." };

  const max = await prisma.showcaseItem.aggregate({ _max: { sortOrder: true } });
  const { id: _id, createdAt: _c, updatedAt: _u, sortOrder: _s, ...rest } = src;
  void _id;
  void _c;
  void _u;
  void _s;
  await prisma.showcaseItem.create({
    data: {
      ...rest,
      title: `${src.title} (copy)`,
      isActive: false,
      sortOrder: (max._max.sortOrder ?? 0) + 1,
    },
  });
  revalidate();
  return { ok: true };
}

export async function deleteShowcaseItem(id: string): Promise<AdminResult> {
  await requirePermission("appearance");
  await prisma.showcaseItem.delete({ where: { id } });
  revalidate();
  return { ok: true };
}

/** Persist a new item order from drag-and-drop (ids, top → bottom). */
export async function reorderShowcaseItems(ids: string[]): Promise<AdminResult> {
  await requirePermission("appearance");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: true };
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.showcaseItem.update({ where: { id }, data: { sortOrder: index } }),
    ),
  );
  revalidate();
  return { ok: true };
}

/** Global on/off for the homepage 3D showcase. */
export async function setShowcaseEnabled(enabled: boolean): Promise<AdminResult> {
  await requirePermission("appearance");
  await prisma.storeSetting.upsert({
    where: { id: "singleton" },
    update: { showcase3dEnabled: enabled },
    create: { id: "singleton", showcase3dEnabled: enabled },
  });
  revalidate();
  return { ok: true };
}
