/**
 * Spin & Win prize selection — pure + deterministic given a random source, so
 * it is unit-tested directly. Server-only by convention (never imported by
 * client code: the weights would reveal inventory).
 *
 * Strategy (documented in docs/growth.md#spin--win):
 *  1. A variant is a candidate only if it is in the campaign's eligible list,
 *     the variant AND its product are active, and `stock > minStock`.
 *  2. Candidates are grouped by product. A product's weight is
 *       min(Σ (stock - minStock) over its candidate variants, weightCap)
 *     — so high-stock products are offered more often, low-stock products
 *     proportionally less, and nothing at/below the reserve ever.
 *     `weightCap` stops one huge-stock SKU from monopolising the wheel.
 *  3. The discount tier is drawn independently by its configured weight.
 */

import type { PrizeTier } from "@/lib/spin/config";

export type VariantStock = {
  variantId: string;
  productId: string;
  stock: number;
  variantActive: boolean;
  productActive: boolean;
};

export type ProductCandidate = { productId: string; variantIds: string[]; weight: number };

export type SelectionConfig = {
  eligibleVariantIds: readonly string[];
  minStock: number;
  weightCap: number;
};

/** Random source in [0, 1). Injected so tests are deterministic. */
export type Rng = () => number;

export function productCandidates(variants: readonly VariantStock[], cfg: SelectionConfig): ProductCandidate[] {
  const eligible = new Set(cfg.eligibleVariantIds);
  const byProduct = new Map<string, ProductCandidate>();
  for (const v of variants) {
    if (!eligible.has(v.variantId) || !v.variantActive || !v.productActive) continue;
    const surplus = v.stock - Math.max(0, cfg.minStock);
    if (surplus <= 0) continue;
    const c = byProduct.get(v.productId) ?? { productId: v.productId, variantIds: [], weight: 0 };
    c.variantIds.push(v.variantId);
    c.weight += surplus;
    byProduct.set(v.productId, c);
  }
  const cap = Math.max(1, cfg.weightCap);
  return [...byProduct.values()]
    .map((c) => ({ ...c, weight: Math.min(c.weight, cap) }))
    .sort((a, b) => a.productId.localeCompare(b.productId)); // stable order → reproducible draws
}

/** Weighted pick; returns null when nothing has positive weight. */
export function weightedPick<T extends { weight: number }>(items: readonly T[], rng: Rng): T | null {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  if (total <= 0) return null;
  let r = rng() * total;
  for (const i of items) {
    const w = Math.max(0, i.weight);
    if (r < w) return i;
    r -= w;
  }
  // Floating-point edge: fall back to the last positive item.
  return [...items].reverse().find((i) => i.weight > 0) ?? null;
}

/** Selection probabilities for the admin preview (same maths as the draw). */
export function probabilities<T extends { weight: number }>(items: readonly T[]): number[] {
  const total = items.reduce((s, i) => s + Math.max(0, i.weight), 0);
  return items.map((i) => (total > 0 ? Math.max(0, i.weight) / total : 0));
}

export type Prize = { percent: number; productId: string; variantIds: string[] };

export function drawPrize(
  variants: readonly VariantStock[],
  cfg: SelectionConfig,
  tiers: readonly PrizeTier[],
  rng: Rng,
): Prize | null {
  const product = weightedPick(productCandidates(variants, cfg), rng);
  const tier = weightedPick(tiers, rng);
  if (!product || !tier) return null;
  return { percent: tier.percent, productId: product.productId, variantIds: product.variantIds };
}

/** Cryptographically strong [0,1) — the default rng for real draws. */
export function secureRandom(): number {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] / 0x1_0000_0000;
}
