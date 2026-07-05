import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { effectivePrice, formatPrice } from "@/lib/format";
import { expandSearchTerms } from "@/lib/recommendations/intent";
import { siteConfig } from "@/config/site";

/**
 * Retrieval layer (RAG seam). Today this performs keyword retrieval over the
 * Postgres catalog and renders compact text "chunks" for grounding the LLM.
 *
 * To add real RAG later, replace the *body* of `retrieveProductContext` with a
 * vector search (e.g. pgvector / an external store) that returns the same
 * `ContextChunk[]` shape — every caller (chat, product assistant) keeps working
 * unchanged. Keep business logic in callers; keep retrieval here.
 */
export type ContextChunk = {
  id: string;
  title: string;
  text: string;
  url: string;
};

type NutritionFact = { label: string; value: string };

const productSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  benefits: true,
  ingredients: true,
  nutritionFacts: true,
  category: { select: { name: true } },
  variants: {
    where: { isActive: true },
    select: { price: true, discountPrice: true, stock: true, weightLabel: true },
  },
} satisfies Prisma.ProductSelect;

type RetrievedProduct = Prisma.ProductGetPayload<{ select: typeof productSelect }>;

function priceRange(variants: RetrievedProduct["variants"]): string {
  if (variants.length === 0) return "price unavailable";
  const prices = variants.map((v) => effectivePrice(v.price, v.discountPrice));
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  return min === max ? formatPrice(min) : `${formatPrice(min)}–${formatPrice(max)}`;
}

function facts(value: Prisma.JsonValue | null): NutritionFact[] {
  return Array.isArray(value) ? (value as unknown as NutritionFact[]) : [];
}

function toChunk(p: RetrievedProduct, detailed = false): ContextChunk {
  const total = p.variants.reduce((s, v) => s + Math.max(0, v.stock), 0);
  const stockLine =
    total === 0 ? "Out of stock" : total <= 10 ? `In stock (only ${total} left)` : "In stock";
  const nf = facts(p.nutritionFacts);
  const parts = [
    `Product: ${p.name}`,
    `Category: ${p.category.name}`,
    `Price: ${priceRange(p.variants)}`,
    `Sizes: ${p.variants.map((v) => v.weightLabel).join(", ") || "—"}`,
    stockLine,
  ];
  if (p.shortDescription) parts.push(`Summary: ${p.shortDescription}`);
  if (p.benefits) parts.push(`Benefits: ${detailed ? p.benefits : p.benefits.slice(0, 220)}`);
  if (detailed && p.ingredients) parts.push(`Ingredients: ${p.ingredients}`);
  if (nf.length) parts.push(`Nutrition: ${nf.map((f) => `${f.label} ${f.value}`).join("; ")}`);

  return {
    id: p.id,
    title: p.name,
    text: parts.join(". "),
    url: `${siteConfig.url}/products/${p.slug}`,
  };
}

/**
 * Retrieve catalog context relevant to a free-text query. Keyword matching is
 * intent-expanded (goal phrases like "weight loss" or "office snacks" map to
 * real catalog terms via `expandSearchTerms`), and in-stock products are
 * surfaced first so the model grounds its suggestions in what's purchasable.
 */
export async function retrieveProductContext(
  query: string,
  limit = 8,
): Promise<ContextChunk[]> {
  const q = query.trim();
  // The raw query + any goal-implied catalog terms ("weight loss" → flax/chia…).
  const terms = [...new Set([q, ...expandSearchTerms(q)].filter(Boolean))].slice(0, 10);

  const matchOne = (t: string): Prisma.ProductWhereInput => ({
    OR: [
      { name: { contains: t, mode: "insensitive" } },
      { shortDescription: { contains: t, mode: "insensitive" } },
      { description: { contains: t, mode: "insensitive" } },
      { benefits: { contains: t, mode: "insensitive" } },
      { category: { name: { contains: t, mode: "insensitive" } } },
    ],
  });

  const where: Prisma.ProductWhereInput =
    terms.length > 0
      ? { isActive: true, OR: terms.map(matchOne) }
      : { isActive: true };

  let products = await prisma.product.findMany({
    where,
    select: productSelect,
    take: limit * 2,
    orderBy: [{ isBestSeller: "desc" }, { ratingCount: "desc" }],
  });

  // Fall back to popular products so the model always has some grounding.
  if (products.length === 0) {
    products = await prisma.product.findMany({
      where: { isActive: true },
      select: productSelect,
      take: limit * 2,
      orderBy: [{ isFeatured: "desc" }, { ratingCount: "desc" }],
    });
  }

  // Purchasable products first — the model must prefer what's in stock.
  const inStock = (p: RetrievedProduct) => p.variants.some((v) => v.stock > 0);
  products.sort((a, b) => Number(inStock(b)) - Number(inStock(a)));

  return products.slice(0, limit).map((p) => toChunk(p));
}

/** Detailed context for a single product (used by the product assistant). */
export async function buildProductChunk(
  productId: string,
): Promise<ContextChunk | null> {
  const p = await prisma.product.findUnique({
    where: { id: productId },
    select: productSelect,
  });
  return p ? toChunk(p, true) : null;
}

/** Render chunks into a compact context block for a system prompt. */
export function chunksToPromptContext(chunks: ContextChunk[]): string {
  if (chunks.length === 0) return "No catalog items matched.";
  return chunks
    .map((c, i) => `[${i + 1}] ${c.text}\nLink: ${c.url}`)
    .join("\n\n");
}
