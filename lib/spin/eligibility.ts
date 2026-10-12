/**
 * Spin & Win eligibility verification — client-safe, pure.
 *
 * Eligibility is ONLY ever a list of exact variant IDs. Before a campaign can
 * go live, an admin verifies that list against the live catalogue; the
 * verification stores a snapshot of each variant's identity and size
 * (product ID, weight label, grams). A campaign is playable only while:
 *   - it has a verification, and the snapshot covers exactly the current
 *     eligible list (editing the list clears the verification), and
 *   - each variant is offered only while its product ID and size still match
 *     the snapshot — a variant moved to another product or relabelled to a
 *     different size drops out until someone re-verifies.
 * Product names are informational (shown, never matched).
 */

import { gramsFromLabel } from "@/lib/spin/config";

export type EligibilitySnapshotItem = {
  variantId: string;
  productId: string;
  productName: string;
  weightLabel: string;
  weightInGrams: number | null;
};

/** Current catalogue facts for a variant, as the verification compares them. */
export type CatalogueVariant = EligibilitySnapshotItem;

/** Validate a stored snapshot JSON blob; anything malformed is dropped. */
export function resolveSnapshot(raw: unknown): EligibilitySnapshotItem[] {
  if (!Array.isArray(raw)) return [];
  const out: EligibilitySnapshotItem[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    if (typeof o.variantId !== "string" || typeof o.productId !== "string" || typeof o.weightLabel !== "string") continue;
    out.push({
      variantId: o.variantId,
      productId: o.productId,
      productName: typeof o.productName === "string" ? o.productName : "",
      weightLabel: o.weightLabel,
      weightInGrams: typeof o.weightInGrams === "number" && Number.isFinite(o.weightInGrams) ? o.weightInGrams : null,
    });
  }
  return out;
}

/** Grams for display/comparison: explicit grams, else parsed from the label. */
export function sizeGrams(v: Pick<EligibilitySnapshotItem, "weightLabel" | "weightInGrams">): number | null {
  return v.weightInGrams ?? gramsFromLabel(v.weightLabel);
}

/** Same product and same size as when verified? (Names may change freely.) */
export function sameIdentity(a: EligibilitySnapshotItem, b: CatalogueVariant): boolean {
  return (
    a.variantId === b.variantId &&
    a.productId === b.productId &&
    a.weightLabel.trim().toLowerCase() === b.weightLabel.trim().toLowerCase() &&
    sizeGrams(a) === sizeGrams(b)
  );
}

/** Same IDs, ignoring order and duplicates. */
export function sameIdSet(a: readonly string[], b: readonly string[]): boolean {
  const sa = new Set(a);
  const sb = new Set(b);
  return sa.size === sb.size && [...sa].every((x) => sb.has(x));
}

type VerifiableCampaign = {
  eligibleVariantIds: readonly string[];
  eligibilityVerifiedAt: Date | string | null;
  eligibilitySnapshot: unknown;
};

/** Verified, and the verification covers exactly the current eligible list. */
export function isEligibilityVerified(c: VerifiableCampaign): boolean {
  if (!c.eligibilityVerifiedAt || c.eligibleVariantIds.length === 0) return false;
  const snap = resolveSnapshot(c.eligibilitySnapshot);
  return sameIdSet(
    snap.map((s) => s.variantId),
    c.eligibleVariantIds,
  );
}

/**
 * Variant IDs that may be offered right now: verified, and still the same
 * product + size in the catalogue. Empty when the campaign isn't verified.
 */
export function playableVariantIds(c: VerifiableCampaign, catalogue: readonly CatalogueVariant[]): string[] {
  if (!isEligibilityVerified(c)) return [];
  const snap = new Map(resolveSnapshot(c.eligibilitySnapshot).map((s) => [s.variantId, s]));
  return catalogue.filter((v) => {
    const s = snap.get(v.variantId);
    return Boolean(s && sameIdentity(s, v));
  }).map((v) => v.variantId);
}

export type EligibilityDrift = {
  /** Verified variants that no longer exist. */
  missing: EligibilitySnapshotItem[];
  /** Verified variants whose product or size changed since verification. */
  changed: { was: EligibilitySnapshotItem; now: CatalogueVariant }[];
  /** Verified variants whose product name changed (informational only). */
  renamed: { was: EligibilitySnapshotItem; now: CatalogueVariant }[];
};

/** What changed in the catalogue since the eligibility was verified. */
export function eligibilityDrift(snapshotRaw: unknown, catalogue: readonly CatalogueVariant[]): EligibilityDrift {
  const byId = new Map(catalogue.map((v) => [v.variantId, v]));
  const drift: EligibilityDrift = { missing: [], changed: [], renamed: [] };
  for (const s of resolveSnapshot(snapshotRaw)) {
    const now = byId.get(s.variantId);
    if (!now) drift.missing.push(s);
    else if (!sameIdentity(s, now)) drift.changed.push({ was: s, now });
    else if (s.productName !== now.productName) drift.renamed.push({ was: s, now });
  }
  return drift;
}

export function hasBlockingDrift(d: EligibilityDrift): boolean {
  return d.missing.length > 0 || d.changed.length > 0;
}
