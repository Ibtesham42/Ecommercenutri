import { prisma } from "@/lib/prisma";
import {
  productCardSelect,
  minVariantPrice,
  type ProductCardData,
} from "@/lib/queries/products";
import { getUserSignals } from "@/lib/recommendations/events";

/**
 * Centralized recommendation service. Every section the storefront renders comes
 * from one of these functions — a single source of truth so the logic is never
 * duplicated. Today these are deterministic, rule-based and DB-driven (so they
 * always work with no AI key); the strategy is isolated here so a future
 * provider (embeddings / vector search / LLM re-ranking) can be slotted in
 * without touching any caller or component. See `lib/ai/provider.ts` for the
 * analogous AI seam.
 */

/** Fetch active product cards for the given ids, preserving the ids' order. */
async function orderedActiveProducts(
  ids: (string | null)[],
  limit: number,
  excludeIds: string[] = [],
): Promise<ProductCardData[]> {
  const exclude = new Set(excludeIds);
  const ordered = ids.filter((id): id is string => !!id && !exclude.has(id));
  const unique = [...new Set(ordered)];
  if (unique.length === 0) return [];

  const products = await prisma.product.findMany({
    where: { isActive: true, id: { in: unique } },
    select: productCardSelect,
  });
  const byId = new Map(products.map((p) => [p.id, p]));
  const out: ProductCardData[] = [];
  for (const id of unique) {
    const p = byId.get(id);
    if (p) out.push(p);
    if (out.length >= limit) break;
  }
  return out;
}

/** Best sellers, derived from real paid-order quantities. */
export async function bestSellers(limit = 8): Promise<ProductCardData[]> {
  const grouped = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { productId: { not: null }, order: { paymentStatus: "PAID" } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit * 3,
  });
  const ranked = await orderedActiveProducts(
    grouped.map((g) => g.productId),
    limit,
  );
  if (ranked.length >= limit) return ranked;

  // Top up with the flagged best-sellers / featured so the strip is never thin.
  const filler = await prisma.product.findMany({
    where: { isActive: true, id: { notIn: ranked.map((p) => p.id) } },
    select: productCardSelect,
    orderBy: [{ isBestSeller: "desc" }, { isFeatured: "desc" }, { ratingCount: "desc" }],
    take: limit - ranked.length,
  });
  return [...ranked, ...filler];
}

/** Products most often bought in the SAME order as the given product. */
export async function frequentlyBoughtTogether(
  productId: string,
  limit = 4,
): Promise<ProductCardData[]> {
  const orders = await prisma.orderItem.findMany({
    where: { productId, order: { paymentStatus: "PAID" } },
    select: { orderId: true },
    take: 500,
  });
  const orderIds = orders.map((o) => o.orderId);
  if (orderIds.length === 0) return [];

  const co = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { orderId: { in: orderIds }, productId: { not: productId } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit * 3,
  });
  return orderedActiveProducts(co.map((c) => c.productId), limit, [productId]);
}

/**
 * "Customers who bought this also bought" — products purchased by the same
 * customers who bought this one (broader than same-order FBT). Falls back to FBT
 * when there isn't enough cross-customer history yet.
 */
export async function customersAlsoBought(
  productId: string,
  limit = 4,
): Promise<ProductCardData[]> {
  const buyers = await prisma.order.findMany({
    where: { paymentStatus: "PAID", items: { some: { productId } } },
    select: { userId: true },
    take: 500,
  });
  const userIds = [...new Set(buyers.map((b) => b.userId))];
  if (userIds.length === 0) return frequentlyBoughtTogether(productId, limit);

  const co = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: {
      productId: { not: productId },
      order: { userId: { in: userIds }, paymentStatus: "PAID" },
    },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit * 3,
  });
  const result = await orderedActiveProducts(
    co.map((c) => c.productId),
    limit,
    [productId],
  );
  return result.length > 0 ? result : frequentlyBoughtTogether(productId, limit);
}

const WORD_RE = /[a-z0-9]+/g;
function tokenize(text: string | null | undefined): Set<string> {
  const set = new Set<string>();
  if (!text) return set;
  for (const m of text.toLowerCase().matchAll(WORD_RE)) {
    if (m[0].length >= 3) set.add(m[0]);
  }
  return set;
}

/**
 * Similar products by content: same category (base), plus signals for shared
 * brand, price proximity and ingredient overlap. Deterministic re-ranking over
 * the category candidates; the scoring seam is where vector similarity would go.
 */
export async function similarProducts(
  productId: string,
  limit = 4,
): Promise<ProductCardData[]> {
  const base = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      categoryId: true,
      brandId: true,
      ingredients: true,
      variants: { where: { isActive: true }, select: { price: true, discountPrice: true } },
    },
  });
  if (!base) return [];

  const candidates = await prisma.product.findMany({
    where: { isActive: true, categoryId: base.categoryId, NOT: { id: productId } },
    select: {
      ...productCardSelect,
      brandId: true,
      ingredients: true,
    },
    take: 50,
  });
  if (candidates.length === 0) return [];

  const basePrice = minVariantPrice(base.variants) ?? 0;
  const baseIngredients = tokenize(base.ingredients);

  const scored = candidates
    .map((c) => {
      let score = 1; // same category
      if (base.brandId && c.brandId === base.brandId) score += 2;

      const cPrice = minVariantPrice(c.variants) ?? 0;
      if (basePrice > 0 && cPrice > 0) {
        const ratio = Math.abs(cPrice - basePrice) / basePrice;
        if (ratio <= 0.15) score += 2;
        else if (ratio <= 0.35) score += 1;
      }

      if (baseIngredients.size > 0) {
        const ci = tokenize(c.ingredients);
        let overlap = 0;
        for (const t of ci) if (baseIngredients.has(t)) overlap++;
        score += Math.min(overlap, 3);
      }

      score += Math.min(c.ratingCount, 5) * 0.1; // gentle popularity tiebreaker
      return { c, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  // Strip the extra fields so we return clean ProductCardData.
  return scored.map(({ c }) => {
    const { brandId: _b, ingredients: _i, ...card } = c;
    void _b;
    void _i;
    return card as ProductCardData;
  });
}

/**
 * Trending products over a window, scored from real signals: views + paid orders
 * + wishlist adds (weighted). Falls back to best sellers when there's not yet
 * enough behavioral data.
 */
export async function trending(
  opts: { windowDays?: number; limit?: number } = {},
): Promise<ProductCardData[]> {
  const { windowDays = 7, limit = 8 } = opts;
  const since = new Date(Date.now() - windowDays * 86_400_000);

  const [views, orders, wishes] = await Promise.all([
    prisma.userEvent.groupBy({
      by: ["productId"],
      where: { type: "PRODUCT_VIEW", productId: { not: null }, createdAt: { gte: since } },
      _count: { productId: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: {
        productId: { not: null },
        order: { paymentStatus: "PAID", createdAt: { gte: since } },
      },
      _sum: { quantity: true },
    }),
    prisma.wishlistItem.groupBy({
      by: ["productId"],
      where: { createdAt: { gte: since } },
      _count: { productId: true },
    }),
  ]);

  const score = new Map<string, number>();
  const add = (id: string | null, n: number) => {
    if (!id || n <= 0) return;
    score.set(id, (score.get(id) ?? 0) + n);
  };
  for (const v of views) add(v.productId, v._count.productId * 1);
  for (const o of orders) add(o.productId, (o._sum.quantity ?? 0) * 4);
  for (const w of wishes) add(w.productId, w._count.productId * 2);

  const ranked = [...score.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  const products = await orderedActiveProducts(ranked, limit);
  if (products.length >= Math.min(limit, 4)) return products;

  // Cold start: fall back to best sellers.
  return bestSellers(limit);
}

/**
 * "Recommended for you" — personalized from the shopper's behavioral signals
 * (recent views, categories, wishlist, purchases), topped up with best sellers.
 * Works for guests (via anonId) and signed-out users (best sellers).
 */
export async function recommendedForYou(opts: {
  userId?: string | null;
  anonId?: string | null;
  excludeProductIds?: string[];
  limit?: number;
}): Promise<ProductCardData[]> {
  const { userId, anonId, excludeProductIds = [], limit = 4 } = opts;
  const exclude = new Set(excludeProductIds);

  const signals = await getUserSignals(userId, anonId);
  signals.purchasedProductIds.forEach((id) => exclude.add(id));
  signals.wishlistProductIds.forEach((id) => exclude.add(id));

  if (signals.categoryIds.length > 0) {
    const recs = await prisma.product.findMany({
      where: {
        isActive: true,
        categoryId: { in: signals.categoryIds },
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

/** Complementary cross-sell for a cart: FBT aggregated across the cart's items. */
export async function complementaryForCart(
  productIds: string[],
  limit = 4,
): Promise<ProductCardData[]> {
  if (productIds.length === 0) return [];
  const inCart = new Set(productIds);

  const orders = await prisma.orderItem.findMany({
    where: { productId: { in: productIds }, order: { paymentStatus: "PAID" } },
    select: { orderId: true },
    take: 800,
  });
  const orderIds = [...new Set(orders.map((o) => o.orderId))];
  if (orderIds.length === 0) {
    return recommendedForYou({ excludeProductIds: productIds, limit });
  }

  const co = await prisma.orderItem.groupBy({
    by: ["productId"],
    where: { orderId: { in: orderIds }, productId: { notIn: productIds } },
    _sum: { quantity: true },
    orderBy: { _sum: { quantity: "desc" } },
    take: limit * 3,
  });
  const result = await orderedActiveProducts(
    co.map((c) => c.productId),
    limit,
    [...inCart],
  );
  return result.length > 0
    ? result
    : recommendedForYou({ excludeProductIds: productIds, limit });
}

// --- AI Product Combos ------------------------------------------------------

export type ProductCombo = {
  key: string;
  title: string;
  description: string;
  products: ProductCardData[];
};

/** Curated, goal-based bundles assembled from the live catalog by category
 *  keyword. Empty combos are dropped so the homepage degrades gracefully. */
const COMBO_DEFS: { key: string; title: string; description: string; match: string[] }[] = [
  {
    key: "breakfast",
    title: "Healthy Breakfast Combo",
    description: "Start the day right",
    match: ["makhana", "seed", "oat", "dry", "nut", "granola", "muesli"],
  },
  {
    key: "weight-loss",
    title: "Weight Loss Combo",
    description: "Light, filling & nutritious",
    match: ["seed", "makhana", "flax", "chia"],
  },
  {
    key: "protein",
    title: "High Protein Combo",
    description: "Fuel your muscles",
    match: ["protein", "seed", "peanut", "nut", "chana", "soy"],
  },
  {
    key: "immunity",
    title: "Immunity Combo",
    description: "Stay strong year-round",
    match: ["nut", "seed", "berry", "amla", "dry"],
  },
];

export async function productCombos(perCombo = 4): Promise<ProductCombo[]> {
  const categories = await prisma.category.findMany({
    where: { isActive: true },
    select: { id: true, slug: true, name: true },
  });

  const out: ProductCombo[] = [];
  for (const def of COMBO_DEFS) {
    const catIds = categories
      .filter((c) =>
        def.match.some(
          (m) => c.slug.includes(m) || c.name.toLowerCase().includes(m),
        ),
      )
      .map((c) => c.id);
    if (catIds.length === 0) continue;

    const products = await prisma.product.findMany({
      where: { isActive: true, categoryId: { in: catIds } },
      select: productCardSelect,
      orderBy: [{ isBestSeller: "desc" }, { ratingCount: "desc" }],
      take: perCombo,
    });
    if (products.length >= 2) {
      out.push({ key: def.key, title: def.title, description: def.description, products });
    }
  }
  return out;
}
