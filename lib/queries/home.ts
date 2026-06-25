import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

const heroSlideSelect = {
  id: true,
  title: true,
  subtitle: true,
  description: true,
  desktopImage: true,
  mobileImage: true,
  ctaText: true,
  ctaUrl: true,
  overlay: true,
  buttonColor: true,
  textAlign: true,
  sortOrder: true,
  isActive: true,
  startsAt: true,
  expiresAt: true,
  product: { select: { slug: true } },
  category: { select: { slug: true } },
} satisfies Prisma.HeroSlideSelect;

export type HeroSlideData = Prisma.HeroSlideGetPayload<{
  select: typeof heroSlideSelect;
}>;

/** Published hero slides within their schedule window, ordered for display. */
export async function getActiveHeroSlides(): Promise<HeroSlideData[]> {
  const now = new Date();
  try {
    return await prisma.heroSlide.findMany({
      where: {
        isActive: true,
        AND: [
          { OR: [{ startsAt: null }, { startsAt: { lte: now } }] },
          { OR: [{ expiresAt: null }, { expiresAt: { gt: now } }] },
        ],
      },
      select: heroSlideSelect,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
  } catch {
    // Never let the homepage fail if the DB is briefly unreachable.
    return [];
  }
}

/** Resolve a slide's destination link (product → category → explicit url). */
export function heroSlideHref(slide: HeroSlideData): string | null {
  if (slide.product?.slug) return `/products/${slide.product.slug}`;
  if (slide.category?.slug) return `/categories/${slide.category.slug}`;
  return slide.ctaUrl || null;
}
