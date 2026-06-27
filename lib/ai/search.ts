import { z } from "zod";
import { generateText } from "ai";
import { prisma } from "@/lib/prisma";
import { getModel } from "@/lib/ai/provider";
import { getAISettings, recordAIUsage } from "@/lib/ai/settings";
import {
  getProducts,
  searchProducts,
  type ProductSort,
  type ProductCardData,
} from "@/lib/queries/products";
import { expandSearchTerms } from "@/lib/recommendations/intent";

/**
 * Keyword search that also understands wellness intent — so "weight loss" surfaces
 * flax/chia/makhana/pumpkin seeds even with no AI key. Unions the literal match
 * with intent-expanded term matches, deduped. This is the keyless smart-search.
 */
export async function smartKeywordSearch(
  query: string,
  limit = 24,
): Promise<ProductCardData[]> {
  const seen = new Set<string>();
  const out: ProductCardData[] = [];
  const push = (items: ProductCardData[]) => {
    for (const p of items) {
      if (!seen.has(p.id)) {
        seen.add(p.id);
        out.push(p);
      }
    }
  };

  push(await searchProducts(query, limit));
  if (out.length < limit) {
    for (const term of expandSearchTerms(query)) {
      push(await searchProducts(term, 8));
      if (out.length >= limit) break;
    }
  }
  return out.slice(0, limit);
}

/**
 * Lenient intent schema. We extract structured search filters via plain text
 * generation (works on any model/provider — no `json_schema` dependency) and
 * parse defensively, so a malformed field never breaks search.
 */
const intentSchema = z.object({
  keywords: z.string().optional().default(""),
  category: z.string().nullish(),
  minPrice: z.number().nullish(),
  maxPrice: z.number().nullish(),
  sort: z
    .enum(["relevance", "price-low", "price-high", "rating", "best-sellers"])
    .optional()
    .default("relevance"),
  bestSellerOnly: z.boolean().optional().default(false),
  summary: z.string().optional().default(""),
});

type Intent = z.infer<typeof intentSchema>;

export type AISearchResult = {
  products: ProductCardData[];
  interpreted: string | null; // model's restatement, when AI was used
  usedAI: boolean;
};

const STOP_WORDS = new Set([
  "the", "and", "for", "with", "under", "below", "above", "over", "less", "than",
  "good", "best", "rich", "low", "high", "show", "find", "me", "some", "any",
  "product", "products", "food", "foods", "item", "items", "buy", "want", "need",
]);

/**
 * Catalog query that leans on the structured filters first (category/price are
 * reliable) and only then on keywords — trying the phrase, then individual
 * tokens, then price-only. `getProducts` matches a single substring, so this
 * progression is what makes multi-word natural-language queries actually return
 * results.
 */
async function runProgressiveSearch(opts: {
  query: string;
  keywords: string;
  category?: string;
  minPrice?: number;
  maxPrice?: number;
  sort: ProductSort;
}): Promise<ProductCardData[]> {
  const { query, keywords, category, minPrice, maxPrice, sort } = opts;
  const run = async (params: Parameters<typeof getProducts>[0]) =>
    (await getProducts({ ...params, perPage: 24 })).products;

  // 1) Category (+ price) — strongest signal when a category was identified.
  if (category) {
    const r = await run({ category, minPrice, maxPrice, sort });
    if (r.length) return r;
  }

  // 2) Keyword phrase (+ price).
  if (keywords.trim()) {
    const r = await run({ q: keywords, minPrice, maxPrice, sort });
    if (r.length) return r;
  }

  // 3) Individual significant tokens, unioned.
  const tokens = (keywords || query)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 3 && !STOP_WORDS.has(t));
  if (tokens.length) {
    const seen = new Set<string>();
    const merged: ProductCardData[] = [];
    for (const t of tokens) {
      for (const p of await run({ q: t, maxPrice, sort })) {
        if (!seen.has(p.id)) {
          seen.add(p.id);
          merged.push(p);
        }
      }
      if (merged.length >= 12) break;
    }
    if (merged.length) return merged;
  }

  // 4) Price-only fallback when a budget was specified.
  if (minPrice != null || maxPrice != null) {
    const r = await run({ minPrice, maxPrice, sort });
    if (r.length) return r;
  }

  return [];
}

/** Pull a JSON object out of a model response (tolerating code fences/prose). */
function parseIntent(text: string): Intent | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end < start) return null;
  try {
    const obj = JSON.parse(text.slice(start, end + 1));
    const parsed = intentSchema.safeParse(obj);
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/**
 * Natural-language product search. When AI is available it extracts structured
 * filters (category, price, sort) and runs them against the existing catalog
 * query; otherwise it cleanly falls back to keyword search. Business logic lives
 * here; the page only renders the result.
 */
export async function aiProductSearch(rawQuery: string): Promise<AISearchResult> {
  const query = rawQuery.trim();
  if (!query) return { products: [], interpreted: null, usedAI: false };

  const settings = await getAISettings();
  const model =
    settings.enabled && settings.searchEnabled ? getModel(settings.model) : null;

  if (!model) {
    return { products: await smartKeywordSearch(query), interpreted: null, usedAI: false };
  }

  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
    });
    const catList = categories.map((c) => `${c.slug} (${c.name})`).join(", ");

    const { text, usage } = await generateText({
      model,
      temperature: 0.2,
      system: `You convert a shopper's natural-language request into catalog search filters for an Indian nutrition store. Prices are in rupees (₹). Valid category slugs: ${catList}.

Respond with ONLY a single JSON object (no markdown, no commentary) using exactly these keys:
{"keywords": string, "category": string|null, "minPrice": number|null, "maxPrice": number|null, "sort": "relevance"|"price-low"|"price-high"|"rating"|"best-sellers", "bestSellerOnly": boolean, "summary": string}
Use null where a field is not implied. "keywords" are short product terms. "summary" restates the request in one short sentence.`,
      prompt: query,
    });
    await recordAIUsage(usage?.totalTokens ?? 0);

    const intent = parseIntent(text);
    if (!intent) {
      return { products: await smartKeywordSearch(query), interpreted: null, usedAI: false };
    }

    const validCategory = categories.find((c) => c.slug === intent.category)?.slug;
    const sort: ProductSort = intent.sort === "relevance" ? "rating" : intent.sort;
    const baseSort: ProductSort = intent.bestSellerOnly ? "best-sellers" : sort;
    const minPrice = intent.minPrice ?? undefined;
    const maxPrice = intent.maxPrice ?? undefined;
    const interpreted = intent.summary || null;

    let products = await runProgressiveSearch({
      query,
      keywords: intent.keywords || query,
      category: validCategory,
      minPrice,
      maxPrice,
      sort: baseSort,
    });
    // Last resort: intent-expanded keyword search (handles goal-style queries).
    if (products.length === 0) products = await smartKeywordSearch(query);

    return { products, interpreted, usedAI: true };
  } catch (err) {
    console.error("[ai] search failed:", err);
    return { products: await smartKeywordSearch(query), interpreted: null, usedAI: false };
  }
}
