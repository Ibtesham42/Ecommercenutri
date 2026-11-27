import { prisma } from "@/lib/prisma";
import { CACHE_TAGS, cachedQuery } from "@/lib/cache";

/** Category name matches for search typeahead (search overlay + suggestions). */
export async function searchCategories(q: string, limit = 3) {
  return prisma.category.findMany({
    where: { isActive: true, name: { contains: q, mode: "insensitive" } },
    select: { name: true, slug: true },
    orderBy: { sortOrder: "asc" },
    take: limit,
  });
}

export async function getCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    // Active products only: storefront counts and "hide empty category" checks.
    include: { _count: { select: { products: { where: { isActive: true } } } } },
  });
}

/** Top-level categories + their subcategories, for the header's category
 *  mega-menu / drawer accordion. Minimal `select` keeps this a plain,
 *  client-serializable shape (no Decimal/Date fields). */
/** Header/drawer nav tree — same for every shopper, so cached (invalidated on any Category write). */
export const getCategoryTree = cachedQuery(readCategoryTree, "category-tree", [CACHE_TAGS.categories]);

function readCategoryTree() {
  return prisma.category.findMany({
    where: { isActive: true, parentId: null },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      slug: true,
      image: true, // mega-menu thumbnails (read-only; nav shows a monogram when null)
      // Live product counts: the nav shows them and hides empty categories.
      _count: { select: { products: { where: { isActive: true } } } },
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          slug: true,
          _count: { select: { products: { where: { isActive: true } } } },
        },
      },
    },
  });
}

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({
    where: { slug },
    include: {
      children: { where: { isActive: true }, orderBy: { sortOrder: "asc" } },
    },
  });
}

export async function getPublishedStories() {
  return prisma.story.findMany({
    where: {
      isPublished: true,
      OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
    },
    orderBy: { sortOrder: "asc" },
    include: {
      product: { select: { slug: true, name: true } },
    },
  });
}
