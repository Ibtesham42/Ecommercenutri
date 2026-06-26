import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { BannerPosition } from "@/lib/banners";

const bannerSelect = {
  id: true,
  title: true,
  subtitle: true,
  description: true,
  desktopImage: true,
  mobileImage: true,
  desktopImageDark: true,
  mobileImageDark: true,
  ctaText: true,
  ctaUrl: true,
  product: { select: { slug: true } },
  category: { select: { slug: true } },
} satisfies Prisma.BannerSelect;

export type BannerData = Prisma.BannerGetPayload<{ select: typeof bannerSelect }>;

/** Active banners for a placement, within schedule, highest priority first. */
export async function getBanners(position: BannerPosition): Promise<BannerData[]> {
  const now = new Date();
  try {
    return await prisma.banner.findMany({
      where: {
        position,
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      select: bannerSelect,
      orderBy: [{ priority: "desc" }, { createdAt: "desc" }],
    });
  } catch {
    return [];
  }
}

/** Resolve a banner's link (product → category → explicit url). */
export function bannerHref(banner: BannerData): string | null {
  if (banner.product?.slug) return `/products/${banner.product.slug}`;
  if (banner.category?.slug) return `/categories/${banner.category.slug}`;
  return banner.ctaUrl || null;
}
