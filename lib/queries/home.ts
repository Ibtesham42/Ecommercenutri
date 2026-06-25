import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  HOME_SECTION_KEYS,
  isHomeSectionKey,
  type HomeSectionKey,
} from "@/lib/home-sections";

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

export type HomeSectionOrderItem = { key: HomeSectionKey; enabled: boolean };

/**
 * Effective homepage section order + visibility. Reads the admin config and
 * merges it with the section registry: configured sections keep their saved
 * order, and any registry keys not yet in the DB are appended (enabled). With
 * no config at all, returns the default registry order, all enabled — i.e. the
 * homepage is unchanged until an admin customizes it.
 */
export async function getHomeSectionOrder(): Promise<HomeSectionOrderItem[]> {
  let rows: { key: string; enabled: boolean }[] = [];
  try {
    rows = await prisma.homeSection.findMany({
      orderBy: { sortOrder: "asc" },
      select: { key: true, enabled: true },
    });
  } catch {
    /* fall back to defaults below */
  }

  const seen = new Set<string>();
  const ordered: HomeSectionOrderItem[] = [];
  for (const r of rows) {
    if (isHomeSectionKey(r.key) && !seen.has(r.key)) {
      seen.add(r.key);
      ordered.push({ key: r.key, enabled: r.enabled });
    }
  }
  // Append any newly-added registry sections not yet persisted.
  for (const key of HOME_SECTION_KEYS) {
    if (!seen.has(key)) ordered.push({ key, enabled: true });
  }
  return ordered;
}
