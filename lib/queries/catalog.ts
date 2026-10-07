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
    include: { _count: { select: { products: true } } },
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
      children: {
        where: { isActive: true },
        orderBy: { sortOrder: "asc" },
        select: { id: true, name: true, slug: true },
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
