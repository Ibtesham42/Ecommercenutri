/**
 * Spin & Win — client-safe catalog + config resolution (no Prisma/server deps).
 * The admin form, the server engine and the wheel UI all read prize tiers
 * through `resolvePrizes`, so a malformed JSON blob can never reach the wheel
 * or the selection logic.
 */

export type PrizeTier = { percent: number; weight: number };

export const PRIZE_PERCENT_MIN = 1;
export const PRIZE_PERCENT_MAX = 50;
export const MAX_PRIZE_TIERS = 8;

/** Sensible starting tiers for a new campaign — admins tune them before enabling. */
export const DEFAULT_PRIZES: PrizeTier[] = [
  { percent: 5, weight: 40 },
  { percent: 10, weight: 35 },
  { percent: 15, weight: 20 },
  { percent: 20, weight: 5 },
];

/** Validate + normalise stored prize tiers. Drops anything out of range or duplicated. */
export function resolvePrizes(raw: unknown): PrizeTier[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<number>();
  const out: PrizeTier[] = [];
  for (const t of raw) {
    if (!t || typeof t !== "object") continue;
    const percent = Math.round(Number((t as PrizeTier).percent));
    const weight = Math.round(Number((t as PrizeTier).weight));
    if (!Number.isFinite(percent) || percent < PRIZE_PERCENT_MIN || percent > PRIZE_PERCENT_MAX) continue;
    if (!Number.isFinite(weight) || weight < 0) continue;
    if (seen.has(percent)) continue;
    seen.add(percent);
    out.push({ percent, weight });
    if (out.length >= MAX_PRIZE_TIERS) break;
  }
  return out.sort((a, b) => a.percent - b.percent);
}

/**
 * The approved eligibility list from the business brief (product + sizes).
 * HINT ONLY: the admin verification screen uses it to label likely matches
 * and flag selections that aren't on the list. It never selects anything and
 * is never the stored rule — campaigns store exact variant IDs, verified by an
 * admin against the live catalogue (lib/spin/eligibility.ts).
 * Spices/powders require "powder" and exclude makhana, so flavoured snacks
 * (e.g. a chilli makhana) aren't suggested as the plain powder.
 */
const NOT_MAKHANA = "(?!.*makhana)";
const powder = (name: string) => new RegExp(`^${NOT_MAKHANA}(?=.*(${name}))(?=.*powder)`, "i");

export const APPROVED_ELIGIBILITY: { label: string; match: RegExp[]; grams: number[] }[] = [
  { label: "Moringa Powder", match: [powder("moringa")], grams: [100, 200] },
  { label: "Turmeric Powder", match: [powder("turmeric|haldi")], grams: [100] },
  { label: "Red Chilli Powder", match: [powder("chil+i|mirch")], grams: [100] },
  { label: "Coriander Powder", match: [powder("coriander|dhania")], grams: [100] },
  { label: "Regular Sattu", match: [/^(?!.*makhana)(?=.*sattu)(?!.*(masala|flavou?r|choco|jaggery|gur|mix))/i], grams: [500] },
  { label: "Amla Powder", match: [powder("amla")], grams: [150] },
  { label: "Tulsi Powder", match: [powder("tulsi")], grams: [150] },
  { label: "Beetroot Powder", match: [powder("beet")], grams: [150] },
  { label: "Regular Makhana", match: [/^(?=.*makhana)(?=.*(regular|plain))(?!.*(phool|premium|rasogul|flour|atta))/i], grams: [250] },
  { label: "Premium Phool Makhana", match: [/^(?=.*makhana)(?=.*(phool|premium))(?!.*(rasogul|flour|atta))/i], grams: [100, 250] },
  { label: "Rasogulla Makhana", match: [/rasogul/i], grams: [100, 250] },
  { label: "Multigrain Flour with Makhana", match: [/^(?=.*(multigrain|flour|atta))(?=.*makhana)/i], grams: [5000] },
];

/** Grams parsed from a weight label ("250g", "5 kg", "1.5kg") when weightInGrams is unset. */
export function gramsFromLabel(label: string): number | null {
  const m = label.toLowerCase().replace(/\s+/g, "").match(/(\d+(?:\.\d+)?)(kg|g)/);
  if (!m) return null;
  const n = Number(m[1]);
  return Math.round(m[2] === "kg" ? n * 1000 : n);
}

/** Which approved-list entry a product/variant looks like (hint only — never eligibility). */
export function approvedSuggestionFor(
  productName: string,
  weightLabel: string,
  weightInGrams: number | null,
): string | null {
  const grams = weightInGrams ?? gramsFromLabel(weightLabel) ?? gramsFromLabel(productName);
  if (grams == null) return null;
  const hit = APPROVED_ELIGIBILITY.find(
    (e) => e.match.some((re) => re.test(productName)) && e.grams.includes(grams),
  );
  return hit?.label ?? null;
}

/** Does a product/variant look like an approved-list entry? (hint only) */
export function isApprovedSuggestion(productName: string, weightLabel: string, weightInGrams: number | null): boolean {
  return approvedSuggestionFor(productName, weightLabel, weightInGrams) !== null;
}

/** Wheel segment label, e.g. "15% OFF". */
export function prizeLabel(percent: number): string {
  return `${percent}% OFF`;
}
