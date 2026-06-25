import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { effectivePrice } from "@/lib/format";

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

/** Lowest effective (sale-aware) price across a product's variants, in paise. */
export function minVariantPrice(
  variants: { price: number; discountPrice: number | null }[],
): number | null {
  if (variants.length === 0) return null;
  return Math.min(...variants.map((v) => effectivePrice(v.price, v.discountPrice)));
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getFeaturedProducts(limit = 8): Promise<ProductCardData[]> {
  return prisma.product.findMany({
    where: { isActive: true, isFeatured: true },
    select: productCardSelect,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function getBestSellers(limit = 8): Promise<ProductCardData[]> {
  return prisma.product.findMany({
    where: { isActive: true, isBestSeller: true },
    select: productCardSelect,
    orderBy: [{ ratingCount: "desc" }, { ratingAvg: "desc" }],
    take: limit,
  });
}

export async function getProductBySlug(
  slug: string,
): Promise<ProductDetailData | null> {
  return prisma.product.findFirst({
    where: { slug, isActive: true },
    include: productDetailInclude,
  });
}

export async function getRelatedProducts(
  productId: string,
  categoryId: string,
  limit = 4,
): Promise<ProductCardData[]> {
  return prisma.product.findMany({
    where: { isActive: true, categoryId, NOT: { id: productId } },
    select: productCardSelect,
    orderBy: [{ isBestSeller: "desc" }, { ratingCount: "desc" }],
    take: limit,
  });
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
  page?: number;
  perPage?: number;
};

export type GetProductsResult = {
  products: ProductCardData[];
  total: number;
  page: number;
  perPage: number;
  pageCount: number;
};

export async function getProducts(
  params: GetProductsParams = {},
): Promise<GetProductsResult> {
  const {
    category,
    q,
    sort = "newest",
    minPrice,
    maxPrice,
    page = 1,
    perPage = 12,
  } = params;

  const priceFilter: Prisma.IntFilter = {};
  if (typeof minPrice === "number") priceFilter.gte = Math.round(minPrice * 100);
  if (typeof maxPrice === "number") priceFilter.lte = Math.round(maxPrice * 100);
  const hasPriceFilter = Object.keys(priceFilter).length > 0;

  const where: Prisma.ProductWhereInput = {
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
    ...(hasPriceFilter
      ? { variants: { some: { isActive: true, price: priceFilter } } }
      : {}),
  };

  const total = await prisma.product.count({ where });
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
