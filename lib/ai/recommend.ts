import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { effectivePrice } from "@/lib/format";
import { expandSearchTerms } from "@/lib/recommendations/intent";
import { getUserSignals } from "@/lib/recommendations/events";
import { frequentlyBoughtTogether, similarProducts } from "@/lib/recommendations/service";
import type { ProductCardData } from "@/lib/queries/products";
import type { AiRecoCard, AiRecoPayload, RecoStockState } from "@/lib/ai/reco-types";

/**
 * Grounded AI recommendation engine. Everything in the payload comes from LIVE
 * database rows — active products with purchasable stock only — scored against
 * the shopper's message intent, quiz profile and behavioral signals. The LLM
 * never generates any of this data; it only talks *about* it, so the cards can
 * never hallucinate products, flavours, pack sizes, prices or offers.
 */

/** Real-stock threshold below which we surface a gentle "limited" state. */
const LOW_STOCK = 10;
/** Popularity floor for the "Popular choice" state. */
const POPULAR_REVIEWS = 10;

const STOPWORDS = new Set([
  "the", "and", "for", "with", "what", "which", "that", "this", "have", "can",
  "you", "your", "are", "will", "want", "need", "give", "show", "best", "good",
  "some", "any", "please", "suggest", "recommend", "recommendation", "products",
  "product", "buy", "under", "about", "from", "should", "would", "could", "like",
]);

function queryTokens(query: string): string[] {
  const out: string[] = [];
  for (const m of query.toLowerCase().matchAll(/[a-z]+/g)) {
    if (m[0].length >= 3 && !STOPWORDS.has(m[0])) out.push(m[0]);
  }
  return [...new Set(out)].slice(0, 8);
}

/** Quiz goal value → an intent phrase `expandSearchTerms` understands. */
const QUIZ_GOAL_PHRASE: Record<string, string> = {
  weight_loss: "weight loss",
  muscle: "high protein",
  energy: "energy",
  immunity: "immunity",
  gut: "diabetic", // fibre-forward picks (makhana/flax/methi) — closest mapping
  wellness: "",
};

/** Does the message look like the shopper wants product suggestions? */
export function wantsRecommendations(query: string): boolean {
  if (expandSearchTerms(query).length > 0) return true;
  return /\b(recommend|suggest|snack|snacks|buy|shop|product|makhana|makhane|dry ?fruit|nut|nuts|seed|seeds|protein|almond|cashew|dates?|raisin|flavou?r|pack|combo|hamper|price|budget|healthy|breakfast|kids|children|office|evening|gift|craving|hungry|munch)\b/i.test(
    query,
  );
}

// --- Candidate shape ------------------------------------------------------------

const recoSelect = {
  id: true,
  name: true,
  slug: true,
  shortDescription: true,
  benefits: true,
  nutritionFacts: true,
  ratingAvg: true,
  ratingCount: true,
  isBestSeller: true,
  isFeatured: true,
  gstRate: true,
  deliveryCharge: true,
  categoryId: true,
  category: { select: { name: true } },
  images: {
    orderBy: [{ isMain: "desc" as const }, { sortOrder: "asc" as const }],
    take: 1,
    select: { url: true },
  },
  variants: {
    where: { isActive: true },
    orderBy: { weightInGrams: "asc" as const },
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

type RecoProduct = Prisma.ProductGetPayload<{ select: typeof recoSelect }>;

const totalStock = (p: { variants: { stock: number }[] }) =>
  p.variants.reduce((s, v) => s + Math.max(0, v.stock), 0);

function stockState(p: RecoProduct): { state: RecoStockState; left: number | null } {
  const total = totalStock(p);
  if (total <= LOW_STOCK) return { state: "limited", left: total };
  if (p.isBestSeller || p.ratingCount >= POPULAR_REVIEWS) {
    return { state: "popular", left: null };
  }
  return { state: "in", left: null };
}

function highlights(p: RecoProduct): string[] {
  const out: string[] = [];
  const nf = Array.isArray(p.nutritionFacts)
    ? (p.nutritionFacts as unknown as { label?: string; value?: string }[])
    : [];
  for (const f of nf) {
    if (f?.label && f?.value) out.push(`${f.label} ${f.value}`);
    if (out.length >= 3) return out;
  }
  if (out.length < 3 && p.category?.name) out.push(p.category.name);
  return out.slice(0, 3);
}

type ScoreContext = {
  terms: string[];
  goalPhrase: string | null; // human phrase for reasons ("weight loss", …)
  quizGoalLabel: string | null;
  affinityCategoryIds: Set<string>;
  purchasedProductIds: Set<string>;
};

type Scored = { p: RecoProduct; score: number; reasons: string[] };

function scoreProduct(p: RecoProduct, ctx: ScoreContext): Scored {
  const hay = {
    name: p.name.toLowerCase(),
    desc: `${p.shortDescription ?? ""} ${p.benefits ?? ""}`.toLowerCase(),
    cat: p.category?.name.toLowerCase() ?? "",
  };
  let score = 0;
  const reasons: string[] = [];

  // Goal / query match — the strongest signal.
  let termHit = false;
  for (const t of ctx.terms) {
    if (hay.name.includes(t)) { score += 3; termHit = true; }
    else if (hay.cat.includes(t)) { score += 2; termHit = true; }
    else if (hay.desc.includes(t)) { score += 1; termHit = true; }
  }
  if (termHit && ctx.goalPhrase) reasons.push(`it fits your ${ctx.goalPhrase} goal`);

  // Quiz profile alignment.
  if (ctx.quizGoalLabel && termHit) {
    score += 2;
    if (!ctx.goalPhrase) reasons.push(`it matches your ${ctx.quizGoalLabel} profile`);
  }

  // Behavioral affinity (browsing/wishlist categories; repeat purchases).
  if (ctx.affinityCategoryIds.has(p.categoryId)) {
    score += 2;
    reasons.push(`you've been exploring ${p.category?.name ?? "this range"}`);
  }
  if (ctx.purchasedProductIds.has(p.id)) {
    score += 1;
    reasons.push("you've enjoyed it before");
  }

  // Popularity + trust (real ratings only).
  if (p.ratingAvg > 0 && p.ratingCount > 0) {
    score += Math.min(p.ratingAvg, 5) * 0.6 + Math.min(p.ratingCount, 50) * 0.02;
    if (p.ratingAvg >= 4.2 && p.ratingCount >= 5) {
      reasons.push(`it's rated ${p.ratingAvg.toFixed(1)}★ by ${p.ratingCount} customers`);
    }
  }
  if (p.isBestSeller) { score += 1.5; reasons.push("it's a customer favourite"); }
  else if (p.isFeatured) score += 0.5;

  // Live promotion (real discount on any variant).
  const discounted = p.variants.some(
    (v) => v.discountPrice != null && v.discountPrice < v.price,
  );
  if (discounted) { score += 1; reasons.push("it's on offer right now"); }

  // Availability comfort: healthy stock is a mild plus; low stock a mild minus.
  const total = totalStock(p);
  if (total > LOW_STOCK * 3) score += 0.5;
  else if (total <= LOW_STOCK) score -= 0.5;

  return { p, score, reasons };
}

function composeReason(reasons: string[], fallback: string): string {
  const picked = [...new Set(reasons)].slice(0, 2);
  if (picked.length === 0) return fallback;
  const sentence = picked.join(", and ");
  return `Picked because ${sentence}.`;
}

function toCard(s: Scored, fallbackReason: string): AiRecoCard | null {
  const p = s.p;
  const inStock = p.variants.filter((v) => v.stock > 0);
  if (inStock.length === 0) return null;
  const variant = inStock.find((v) => v.isDefault) ?? inStock[0];
  const price = effectivePrice(variant.price, variant.discountPrice);
  const discountPct =
    variant.discountPrice != null && variant.discountPrice < variant.price
      ? Math.round(((variant.price - variant.discountPrice) / variant.price) * 100)
      : null;
  const { state, left } = stockState(p);

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    image: p.images[0]?.url ?? null,
    category: p.category?.name ?? "",
    variantId: variant.id,
    packSize: variant.weightLabel,
    price,
    mrp: variant.price,
    discountPct,
    rating: p.ratingCount > 0 ? p.ratingAvg : null,
    ratingCount: p.ratingCount,
    stockState: state,
    stockLeft: state === "limited" ? left : null,
    maxStock: variant.stock,
    highlights: highlights(p),
    reason: composeReason(s.reasons, fallbackReason),
    gstRate: p.gstRate,
    deliveryCharge: p.deliveryCharge,
  };
}

/** Re-fetch card products through the reco select (ordered, in-stock only). */
async function cardsForIds(
  ids: string[],
  ctx: ScoreContext,
  fallbackReason: string,
  limit: number,
): Promise<AiRecoCard[]> {
  if (ids.length === 0) return [];
  const rows = await prisma.product.findMany({
    where: { id: { in: ids }, isActive: true },
    select: recoSelect,
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const out: AiRecoCard[] = [];
  for (const id of ids) {
    const row = byId.get(id);
    if (!row || totalStock(row) === 0) continue;
    const card = toCard(scoreProduct(row, ctx), fallbackReason);
    if (card) out.push(card);
    if (out.length >= limit) break;
  }
  return out;
}

const inStockIds = (cards: ProductCardData[]) =>
  cards
    .filter((c) => c.variants.some((v) => v.stock > 0))
    .map((c) => c.id);

// --- Main entry -------------------------------------------------------------------

export async function getGroundedRecommendations(opts: {
  query: string;
  userId?: string | null;
  anonId?: string | null;
  limit?: number;
}): Promise<AiRecoPayload | null> {
  const { query, userId, anonId, limit = 3 } = opts;

  try {
    // Personal context (all optional, all real data).
    const [signals, quiz] = await Promise.all([
      getUserSignals(userId ?? null, anonId ?? null),
      userId || anonId
        ? prisma.healthQuizResult.findFirst({
            where: userId ? { userId } : { anonId: anonId! },
            orderBy: { createdAt: "desc" },
            select: { answers: true },
          })
        : Promise.resolve(null),
    ]);

    const answers = (quiz?.answers ?? {}) as Record<string, string>;
    const quizGoal = answers.goal ?? null;
    const quizGoalLabel = quizGoal ? quizGoal.replace(/_/g, " ") : null;

    // Intent terms: explicit query intent first, else the quiz goal's intent.
    const intentTerms = expandSearchTerms(query);
    const goalPhrase = intentTerms.length > 0 ? detectGoalPhrase(query) : null;
    const quizTerms =
      intentTerms.length === 0 && quizGoal
        ? expandSearchTerms(QUIZ_GOAL_PHRASE[quizGoal] ?? "")
        : [];
    const terms = [
      ...new Set([...intentTerms, ...quizTerms, ...queryTokens(query)]),
    ].slice(0, 12);

    const ctx: ScoreContext = {
      terms,
      goalPhrase,
      quizGoalLabel,
      affinityCategoryIds: new Set(signals.categoryIds),
      purchasedProductIds: new Set(signals.purchasedProductIds),
    };

    // Candidates: ACTIVE products matching the intent (stock filtered in JS so
    // we can also detect an asked-for product that's out of stock).
    const termWhere: Prisma.ProductWhereInput[] = terms.map((t) => ({
      OR: [
        { name: { contains: t, mode: "insensitive" } },
        { shortDescription: { contains: t, mode: "insensitive" } },
        { benefits: { contains: t, mode: "insensitive" } },
        { category: { name: { contains: t, mode: "insensitive" } } },
      ],
    }));

    let candidates = await prisma.product.findMany({
      where: terms.length > 0 ? { isActive: true, OR: termWhere } : { isActive: true },
      select: recoSelect,
      orderBy: [{ isBestSeller: "desc" }, { ratingCount: "desc" }],
      take: 40,
    });

    // Personal fallback: nothing matched the words — use affinity categories,
    // then the storewide favourites, so there is ALWAYS a real recommendation.
    if (candidates.filter((c) => totalStock(c) > 0).length === 0) {
      candidates = await prisma.product.findMany({
        where: {
          isActive: true,
          variants: { some: { isActive: true, stock: { gt: 0 } } },
          ...(signals.categoryIds.length > 0
            ? { categoryId: { in: signals.categoryIds } }
            : {}),
        },
        select: recoSelect,
        orderBy: [{ isBestSeller: "desc" }, { isFeatured: "desc" }, { ratingCount: "desc" }],
        take: 20,
      });
      if (candidates.length === 0) {
        candidates = await prisma.product.findMany({
          where: { isActive: true, variants: { some: { isActive: true, stock: { gt: 0 } } } },
          select: recoSelect,
          orderBy: [{ isBestSeller: "desc" }, { ratingCount: "desc" }],
          take: 20,
        });
      }
    }

    // Out-of-stock ask: the shopper named a product we carry but can't sell now.
    const q = query.toLowerCase();
    const askedOos = candidates.find(
      (c) => totalStock(c) === 0 && q.includes(c.name.toLowerCase()),
    );

    const purchasable = candidates.filter((c) => totalStock(c) > 0);
    const scored = purchasable
      .map((p) => scoreProduct(p, ctx))
      .sort((a, b) => b.score - a.score);

    const fallbackReason = "A well-loved healthy pick from our current range.";
    let primary = scored
      .slice(0, limit + 2)
      .map((s) => toCard(s, fallbackReason))
      .filter((c): c is AiRecoCard => c !== null)
      .slice(0, limit);

    let note: string | undefined;
    if (askedOos) {
      note = `${askedOos.name} is currently out of stock — here are close matches you can order today.`;
      // Lead with true alternatives to the unavailable product.
      const alts = await similarProducts(askedOos.id, limit + 2);
      const altCards = await cardsForIds(
        inStockIds(alts),
        ctx,
        `A close alternative to ${askedOos.name}.`,
        limit,
      );
      if (altCards.length > 0) {
        const seen = new Set(altCards.map((c) => c.id));
        primary = [...altCards, ...primary.filter((c) => !seen.has(c.id))].slice(0, limit);
      }
    }

    if (primary.length === 0) return null;

    // Cross-sell: what real customers buy alongside the top pick.
    const top = primary[0];
    let crossIds = inStockIds(await frequentlyBoughtTogether(top.id, 6));
    if (crossIds.length === 0) crossIds = inStockIds(await similarProducts(top.id, 6));
    const primaryIds = new Set(primary.map((c) => c.id));
    const crossSell = (
      await cardsForIds(
        crossIds.filter((id) => !primaryIds.has(id)),
        ctx,
        `Pairs well with ${top.name}.`,
        3,
      )
    ).map((c) => ({ ...c, reason: `Pairs well with ${top.name}.` }));

    return { primary, crossSell, note };
  } catch (err) {
    console.error("[ai] getGroundedRecommendations failed:", err);
    return null; // never break the chat
  }
}

/** Human phrase for the matched goal (for reason copy). */
function detectGoalPhrase(query: string): string | null {
  const q = query.toLowerCase();
  const pairs: [RegExp, string][] = [
    [/weight|slim|diet|calorie/, "weight-loss"],
    [/protein|muscle|gym|workout/, "protein"],
    [/immunity|immune/, "immunity"],
    [/energy|stamina|tired|fatigue/, "energy"],
    [/office|work|desk/, "office-snacking"],
    [/kids|children|child|school|tiffin/, "kids-friendly"],
    [/evening|night|craving|crunchy/, "evening-snack"],
    [/breakfast|morning/, "breakfast"],
    [/gift|festive|diwali|hamper/, "gifting"],
    [/diabet|sugar/, "sugar-conscious"],
    [/heart|cholesterol/, "heart-health"],
    [/skin|hair|glow/, "skin & hair"],
  ];
  for (const [re, phrase] of pairs) if (re.test(q)) return phrase;
  return null;
}
