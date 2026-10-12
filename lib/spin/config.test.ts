import { describe, expect, it } from "vitest";
import { gramsFromLabel, isApprovedSuggestion, resolvePrizes } from "@/lib/spin/config";

describe("resolvePrizes", () => {
  it("drops malformed, out-of-range and duplicate tiers and sorts by percent", () => {
    expect(
      resolvePrizes([
        { percent: 20, weight: 5 },
        { percent: 5, weight: 40 },
        { percent: 5, weight: 1 }, // duplicate
        { percent: 0, weight: 10 }, // below range
        { percent: 90, weight: 10 }, // above range
        { percent: 10, weight: -1 }, // negative weight
        "junk",
        null,
      ]),
    ).toEqual([
      { percent: 5, weight: 40 },
      { percent: 20, weight: 5 },
    ]);
  });

  it("returns [] for non-arrays", () => {
    expect(resolvePrizes({ percent: 10 })).toEqual([]);
    expect(resolvePrizes(null)).toEqual([]);
  });
});

describe("approved-list suggestions (reviewer hints only)", () => {
  it("parses weights from labels", () => {
    expect(gramsFromLabel("250g")).toBe(250);
    expect(gramsFromLabel("5 kg")).toBe(5000);
    expect(gramsFromLabel("1.5kg")).toBe(1500);
    expect(gramsFromLabel("Large")).toBeNull();
  });

  it("matches listed products at listed sizes only", () => {
    expect(isApprovedSuggestion("Moringa Powder", "200g", 200)).toBe(true);
    expect(isApprovedSuggestion("Moringa Powder", "500g", 500)).toBe(false);
    expect(isApprovedSuggestion("Rasogulla Makhana (250g)", "Default", null)).toBe(true);
    expect(isApprovedSuggestion("Phool Premium Makhana (Fox Nuts) 250g", "250g", 250)).toBe(true);
    expect(isApprovedSuggestion("Multigrain Flour with Makhana", "5kg", 5000)).toBe(true);
    expect(isApprovedSuggestion("Alphonso Mango", "1kg", 1000)).toBe(false);
  });

  it("keeps the makhana variants apart", () => {
    // Regular (plain) 250 g is listed; plain 100 g is not.
    expect(isApprovedSuggestion("Plain Makhana", "250g", 250)).toBe(true);
    expect(isApprovedSuggestion("Plain Makhana (100g)", "100g", 100)).toBe(false);
    // Flour isn't mistaken for premium/regular makhana.
    expect(isApprovedSuggestion("Multigrain Flour with Makhana", "250g", 250)).toBe(false);
  });
});
