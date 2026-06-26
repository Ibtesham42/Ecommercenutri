"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { bannerSchema } from "@/lib/validations/admin";
import { isBannerPosition } from "@/lib/banners";
import type { AdminResult } from "@/lib/actions/admin/types";

function revalidate() {
  revalidatePath("/admin/banners");
  revalidatePath("/", "layout"); // banners render across storefront pages
}

export async function saveBanner(input: unknown): Promise<AdminResult> {
  await requirePermission("appearance");

  const parsed = bannerSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid banner." };
  }
  const d = parsed.data;
  if (!isBannerPosition(d.position)) {
    return { ok: false, error: "Choose a valid placement." };
  }
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
    position: d.position,
    priority: d.priority,
    isActive: d.isActive,
    startsAt: d.startsAt ?? null,
    expiresAt: d.expiresAt ?? null,
  };

  if (d.id) {
    await prisma.banner.update({ where: { id: d.id }, data });
  } else {
    await prisma.banner.create({ data });
  }
  revalidate();
  return { ok: true };
}

export async function toggleBanner(id: string, isActive: boolean): Promise<AdminResult> {
  await requirePermission("appearance");
  await prisma.banner.update({ where: { id }, data: { isActive } });
  revalidate();
  return { ok: true };
}

export async function duplicateBanner(id: string): Promise<AdminResult> {
  await requirePermission("appearance");
  const src = await prisma.banner.findUnique({ where: { id } });
  if (!src) return { ok: false, error: "Banner not found." };

  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = src;
  void _id;
  void _c;
  void _u;
  await prisma.banner.create({
    data: {
      ...rest,
      title: src.title ? `${src.title} (copy)` : null,
      isActive: false,
    },
  });
  revalidate();
  return { ok: true };
}

export async function deleteBanner(id: string): Promise<AdminResult> {
  await requirePermission("appearance");
  await prisma.banner.delete({ where: { id } });
  revalidate();
  return { ok: true };
}
