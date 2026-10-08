import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { discountPercent, minVariantPrice } from "@/lib/format";
import { withDbRetry } from "@/lib/db-retry";

// ---------------------------------------------------------------------------
// Shared selects
// ---------------------------------------------------------------------------

export const productCardSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  ratingAvg: true,
  ratingCount: true,
  isBestSeller: true,
  isFeatured: true,
  category: { select: { name: true, slug: true } },
  images: {
    orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
    take: 1,
    select: { url: true, alt: true },
  },
  variants: {
    where: { isActive: true },
    orderBy: { weightInGrams: "asc" },
    select: {
      id: true,
      weightLabel: true,
      price: true,
      discountPrice: true,
      stock: true,
      isDefault: true,
    },
  },
} satisfies Prisma.ProductSelect;

export type ProductCardData = Prisma.ProductGetPayload<{
  select: typeof productCardSelect;
}>;

export const productDetailInclude = {
  category: true,
  brand: true,
  images: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] },
  variants: { where: { isActive: true }, orderBy: { weightInGrams: "asc" } },
  reviews: {
    where: { isApproved: true },
    orderBy: { createdAt: "desc" },
    include: { user: { select: { name: true, image: true } } },
  },
} satisfies Prisma.ProductInclude;

export type ProductDetailData = Prisma.ProductGetPayload<{
  include: typeof productDetailInclude;
}>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Pure helper lives in lib/format (client-safe); re-exported for server callers.
export { minVariantPrice } from "@/lib/format";

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getFeaturedProducts(limit = 8): Promise<ProductCardData[]> {
  return withDbRetry(() =>
    prisma.product.findMany({
      where: { isActive: true, isFeatured: true },
      select: productCardSelect,
      orderBy: { createdAt: "desc" },
      take: limit,
    }),
  );
}

export async function getBestSellers(limit = 8): Promise<ProductCardData[]> {
  return withDbRetry(() =>
    prisma.product.findMany({
      where: { isActive: true, isBestSeller: true },
      select: productCardSelect,
      orderBy: [{ ratingCount: "desc" }, { ratingAvg: "desc" }],
      take: limit,
    }),
  );
}

/**
 * Products currently on a real, admin-set discount, ranked by the discount
 * shown on their card (same default-variant math `ProductCard` uses) — never
 * invented urgency or fake savings, just the biggest genuine discounts first.
 */
export async function getDealProducts(limit = 8): Promise<ProductCardData[]> {
  const candidates = await withDbRetry(() =>
    prisma.product.findMany({
      where: {
        isActive: true,
        variants: { some: { isActive: true, discountPrice: { gt: 0 } } },
      },
      select: productCardSelect,
      take: 60,
    }),
  );
  return candidates
    .map((p) => {
      const defaultVariant = p.variants.find((v) => v.isDefault) ?? p.variants[0];
      const off = defaultVariant
        ? discountPercent(defaultVariant.price, defaultVariant.discountPrice)
        : null;
      return { product: p, off: off ?? 0 };
    })
    .filter((x) => x.off > 0)
    .sort((a, b) => b.off - a.off)
    .slice(0, limit)
    .map((x) => x.product);
}

export const quickViewSelect = {
  id: true,
  name: true,
  slug: true,
  ratingAvg: true,
  ratingCount: true,
  isBestSeller: true,
  category: { select: { name: true, slug: true } },
  images: {
    orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
    take: 4,
    select: { url: true, alt: true },
  },
  variants: {
    where: { isActive: true },
    orderBy: { weightInGrams: "asc" },
    select: {
      id: true,
      weightLabel: true,
      price: true,
      discountPrice: true,
      stock: true,
      isDefault: true,
    },
  },
} satisfies Prisma.ProductSelect;

export type QuickViewProductData = Prisma.ProductGetPayload<{
  select: typeof quickViewSelect;
}>;

/** Trimmed product payload for the product-card Quick View modal — a few
 *  images and variant pricing, not the full PDP (no reviews/description). */
export async function getQuickViewProduct(id: string): Promise<QuickViewProductData | null> {
  return withDbRetry(() =>
    prisma.product.findFirst({
      where: { id, isActive: true },
      select: quickViewSelect,
    }),
  );
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductDetailData | null> {
  return withDbRetry(() =>
    prisma.product.findFirst({
      where: { slug, isActive: true },
      include: productDetailInclude,
    }),
  );
}

export async function getRelatedProducts(
  productId: string,
  categoryId: string,
  limit = 4,
): Promise<ProductCardData[]> {
  return withDbRetry(() =>
    prisma.product.findMany({
      where: { isActive: true, categoryId, NOT: { id: productId } },
      select: productCardSelect,
      orderBy: [{ isBestSeller: "desc" }, { ratingCount: "desc" }],
      take: limit,
    }),
  );
}

export type ProductSort =
  | "newest"
  | "best-sellers"
  | "rating"
  | "price-low"
  | "price-high";

export type GetProductsParams = {
  category?: string;
  q?: string;
  sort?: ProductSort;
  minPrice?: number; // rupees
  maxPrice?: number; // rupees
  onSale?: boolean;
  inStock?: boolean;
  minRating?: number;
  /** Only products created within the last 30 days — backs /new-arrivals. */
  newOnly?: boolean;
  page?: number;
  perPage?: number;
};

const NEW_ARRIVAL_WINDOW_DAYS = 30;

export type GetProductsResult = {
  products: ProductCardData[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

/**
 * Variant whose SELLING price (`effectivePrice`: the discount price when it's
 * a real one, i.e. > 0 and below MRP; otherwise MRP) falls within `range`.
 */
function sellingPriceWithin(range: Prisma.IntFilter): Prisma.ProductVariantWhereInput {
  const mrp = prisma.productVariant.fields.price;
  return {
    OR: [
      { discountPrice: { ...range, gt: 0, lt: mrp } },
      {
        price: range,
        OR: [{ discountPrice: null }, { discountPrice: { lte: 0 } }, { discountPrice: { gte: mrp } }],
      },
    ],
  };
}

/** The catalog `where` for `getProducts` (pure — exported for tests). */
export function buildProductWhere(params: GetProductsParams = {}): Prisma.ProductWhereInput {
  const { category, q, minPrice, maxPrice, onSale, inStock, minRating, newOnly } = params;

  const priceFilter: Prisma.IntFilter = {};
  if (typeof minPrice === "number") priceFilter.gte = Math.round(minPrice * 100);
  if (typeof maxPrice === "number") priceFilter.lte = Math.round(maxPrice * 100);

  // All variant-level filters go into ONE `some`, so they combine (spreading a
  // separate `variants` key per filter let the last one silently win) and a
  // single variant must satisfy them all — e.g. "under ₹200 + in stock" means
  // an in-stock size that sells under ₹200.
  const variantFilters: Prisma.ProductVariantWhereInput[] = [];
  if (Object.keys(priceFilter).length > 0) variantFilters.push(sellingPriceWithin(priceFilter));
  // discountPrice > 0 is the same "really on sale" signal effectivePrice()/
  // discountPercent() already trust elsewhere — the admin form only lets a
  // discount price through when it's below MRP.
  if (onSale) variantFilters.push({ discountPrice: { gt: 0 } });
  if (inStock) variantFilters.push({ stock: { gt: 0 } });

  return {
    isActive: true,
    ...(category ? { category: { slug: category } } : {}),
    ...(q
      ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { shortDescription: { contains: q, mode: "insensitive" } },
            { description: { contains: q, mode: "insensitive" } },
            { category: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
    ...(variantFilters.length > 0
      ? { variants: { some: { isActive: true, AND: variantFilters } } }
      : {}),
    ...(typeof minRating === "number" ? { ratingAvg: { gte: minRating } } : {}),
    ...(newOnly
      ? {
          createdAt: {
            gte: new Date(Date.now() - NEW_ARRIVAL_WINDOW_DAYS * 24 * 60 * 60 * 1000),
          },
        }
      : {}),
  };
}

export async function getProducts(
  params: GetProductsParams = {},
): Promise<GetProductsResult> {
  const { sort = "newest", page = 1, perPage = 12 } = params;
  const where = buildProductWhere(params);

  // First DB touch in this call — the one most likely to hit a cold Neon
  // connection on a fresh request. One retry here warms it for the
  // find-many call(s) below.
  const total = await withDbRetry(() => prisma.product.count({ where }));
  const pageCount = Math.max(1, Math.ceil(total / perPage));
  const safePage = Math.min(Math.max(1, page), pageCount);

  // Price sorts depend on per-variant prices, so we sort in memory over the
  // filtered set. (For very large catalogs, denormalize a minPrice column.)
  if (sort === "price-low" || sort === "price-high") {
    const all = await prisma.product.findMany({
      where,
      select: productCardSelect,
      take: 500,
    });
    all.sort((a, b) => {
      const pa = minVariantPrice(a.variants) ?? Number.MAX_SAFE_INTEGER;
      const pb = minVariantPrice(b.variants) ?? Number.MAX_SAFE_INTEGER;
      return sort === "price-low" ? pa - pb : pb - pa;
    });
    const start = (safePage - 1) * perPage;
    return {
      products: all.slice(start, start + perPage),
      total,
      page: safePage,
      perPage,
      pageCount,
    };
  }

  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sort === "best-sellers"
      ? [{ isBestSeller: "desc" }, { ratingCount: "desc" }]
      : sort === "rating"
        ? [{ ratingAvg: "desc" }, { ratingCount: "desc" }]
        : [{ createdAt: "desc" }];

  const products = await prisma.product.findMany({
    where,
    select: productCardSelect,
    orderBy,
    skip: (safePage - 1) * perPage,
    take: perPage,
  });

  return { products, total, page: safePage, perPage, pageCount };
}

export async function searchProducts(
  q: string,
  limit = 24,
): Promise<ProductCardData[]> {
  if (!q.trim()) return [];
  const { products } = await getProducts({ q, perPage: limit, sort: "rating" });
  return products;
}
