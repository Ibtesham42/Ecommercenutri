import { prisma } from "@/lib/prisma";

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

export async function getCategoryBySlug(slug: string) {
  return prisma.category.findUnique({ where: { slug } });
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
