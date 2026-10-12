import { describe, expect, it } from "vitest";
import {
  eligibilityDrift,
  hasBlockingDrift,
  isEligibilityVerified,
  playableVariantIds,
  resolveSnapshot,
  sameIdSet,
} from "@/lib/spin/eligibility";
import { approvedSuggestionFor, isApprovedSuggestion } from "@/lib/spin/config";

/** Phase 3: exact variant IDs + sizes, verified before anything is playable. */

const item = (variantId: string, over: Record<string, unknown> = {}) => ({
  variantId,
  productId: `p_${variantId}`,
  productName: `Product ${variantId}`,
  weightLabel: "100g",
  weightInGrams: 100,
  ...over,
});
const campaign = (over: Record<string, unknown> = {}) => ({
  eligibleVariantIds: ["a", "b"],
  eligibilityVerifiedAt: new Date(),
  eligibilitySnapshot: [item("a"), item("b")],
  ...over,
});

describe("isEligibilityVerified", () => {
  it("needs a verification covering exactly the current list", () => {
    expect(isEligibilityVerified(campaign())).toBe(true);
    expect(isEligibilityVerified(campaign({ eligibleVariantIds: ["b", "a"] }))).toBe(true); // order doesn't matter
    expect(isEligibilityVerified(campaign({ eligibilityVerifiedAt: null }))).toBe(false);
    expect(isEligibilityVerified(campaign({ eligibleVariantIds: ["a", "b", "c"] }))).toBe(false); // added after verifying
    expect(isEligibilityVerified(campaign({ eligibleVariantIds: ["a"] }))).toBe(false); // removed after verifying
    expect(isEligibilityVerified(campaign({ eligibleVariantIds: [] }))).toBe(false);
    expect(isEligibilityVerified(campaign({ eligibilitySnapshot: "junk" }))).toBe(false);
  });
});

describe("playableVariantIds — only the same product and size as verified", () => {
  it("passes unchanged variants (a rename alone is fine)", () => {
    expect(playableVariantIds(campaign(), [item("a"), item("b", { productName: "Renamed" })])).toEqual(["a", "b"]);
  });
  it("drops a variant whose size or product changed, or that disappeared", () => {
    expect(playableVariantIds(campaign(), [item("a", { weightLabel: "500g", weightInGrams: 500 }), item("b")])).toEqual(["b"]);
    expect(playableVariantIds(campaign(), [item("a", { weightInGrams: 250 }), item("b")])).toEqual(["b"]);
    expect(playableVariantIds(campaign(), [item("a", { productId: "p_other" }), item("b")])).toEqual(["b"]);
    expect(playableVariantIds(campaign(), [item("b")])).toEqual(["b"]);
  });
  it("nothing is playable from an unverified campaign", () => {
    expect(playableVariantIds(campaign({ eligibilityVerifiedAt: null }), [item("a"), item("b")])).toEqual([]);
  });
  it("never plays a catalogue variant that wasn't verified", () => {
    expect(playableVariantIds(campaign(), [item("a"), item("b"), item("z")])).toEqual(["a", "b"]);
  });
});

describe("eligibilityDrift", () => {
  it("separates blocking changes from renames", () => {
    const d = eligibilityDrift([item("a"), item("b"), item("c")], [
      item("a", { productName: "New name" }),
      item("b", { weightLabel: "200g", weightInGrams: 200 }),
    ]);
    expect(d.renamed.map((r) => r.now.variantId)).toEqual(["a"]);
    expect(d.changed.map((r) => r.now.variantId)).toEqual(["b"]);
    expect(d.missing.map((m) => m.variantId)).toEqual(["c"]);
    expect(hasBlockingDrift(d)).toBe(true);
    expect(hasBlockingDrift(eligibilityDrift([item("a")], [item("a", { productName: "x" })]))).toBe(false);
  });
});

describe("helpers", () => {
  it("resolveSnapshot drops malformed entries", () => {
    expect(resolveSnapshot([item("a"), { variantId: 1 }, null, "x"])).toHaveLength(1);
    expect(resolveSnapshot(null)).toEqual([]);
  });
  it("sameIdSet ignores order and duplicates", () => {
    expect(sameIdSet(["a", "b"], ["b", "a"])).toBe(true);
    expect(sameIdSet(["a", "b"], ["a", "a"])).toBe(false);
    expect(sameIdSet(["a", "a"], ["a"])).toBe(true);
  });
});

describe("approved-list hints are narrow (labels only, never eligibility)", () => {
  it("suggests the listed powders at listed sizes", () => {
    expect(approvedSuggestionFor("Red Chilli Powder", "100g", 100)).toBe("Red Chilli Powder");
    expect(approvedSuggestionFor("Organic Amla Powder", "150g", 150)).toBe("Amla Powder");
    expect(isApprovedSuggestion("Regular Sattu", "500g", 500)).toBe(true);
  });
  it("does not over-match flavoured or different products (audit B4)", () => {
    expect(isApprovedSuggestion("Chilli Makhana", "100g", 100)).toBe(false);
    expect(isApprovedSuggestion("Peri Peri Chilli Makhana", "100g", 100)).toBe(false);
    expect(isApprovedSuggestion("Amla Candy", "150g", 150)).toBe(false);
    expect(isApprovedSuggestion("Masala Sattu Drink Mix", "500g", 500)).toBe(false);
    expect(isApprovedSuggestion("Chocolate Sattu", "500g", 500)).toBe(false);
    expect(isApprovedSuggestion("Beetroot Chips", "150g", 150)).toBe(false);
    expect(isApprovedSuggestion("Turmeric Latte Mix", "100g", 100)).toBe(false);
  });
});
