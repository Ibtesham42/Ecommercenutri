import { prisma } from "@/lib/prisma";
import { productCardSelect, type ProductCardData } from "@/lib/queries/products";

/**
 * Product recommendations. Deterministic and DB-driven so they always work —
 * even with no AI key. Signals: a logged-in user's wishlist + purchase history
 * (category affinity), topped up with best sellers / featured products. The
 * `excludeProductIds` arg lets callers drop items already in cart / on screen.
 */
export async function getRecommendations(opts: {
  userId?: string | null;
  excludeProductIds?: string[];
  limit?: number;
}): Promise<ProductCardData[]> {
  const { userId, excludeProductIds = [], limit = 4 } = opts;
  const exclude = new Set(excludeProductIds);

  if (userId) {
    const [wishlist, orderItems] = await Promise.all([
      prisma.wishlistItem.findMany({
        where: { userId },
        select: { product: { select: { id: true, categoryId: true } } },
      }),
      prisma.orderItem.findMany({
        where: { order: { userId } },
        select: { productId: true, product: { select: { categoryId: true } } },
        take: 50,
      }),
    ]);

    const categoryIds = new Set<string>();
    for (const w of wishlist) {
      categoryIds.add(w.product.categoryId);
      exclude.add(w.product.id);
    }
    for (const o of orderItems) {
      if (o.product?.categoryId) categoryIds.add(o.product.categoryId);
      if (o.productId) exclude.add(o.productId);
    }

    if (categoryIds.size > 0) {
      const recs = await prisma.product.findMany({
        where: {
          isActive: true,
          categoryId: { in: [...categoryIds] },
          id: { notIn: [...exclude] },
        },
        select: productCardSelect,
        orderBy: [{ isBestSeller: "desc" }, { ratingCount: "desc" }],
        take: limit,
      });
      if (recs.length >= limit) return recs;
      recs.forEach((r) => exclude.add(r.id));
      const filler = await topUp(limit - recs.length, exclude);
      return [...recs, ...filler];
    }
  }

  return topUp(limit, exclude);
}

async function topUp(limit: number, exclude: Set<string>): Promise<ProductCardData[]> {
  if (limit <= 0) return [];
  return prisma.product.findMany({
    where: { isActive: true, id: { notIn: [...exclude] } },
    select: productCardSelect,
    orderBy: [{ isBestSeller: "desc" }, { isFeatured: "desc" }, { ratingCount: "desc" }],
    take: limit,
  });
}
