import { describe, expect, it } from "vitest";
import {
  drawPrize,
  probabilities,
  productCandidates,
  weightedPick,
  type VariantStock,
} from "@/lib/spin/selection";

const v = (variantId: string, productId: string, stock: number, extra: Partial<VariantStock> = {}): VariantStock => ({
  variantId,
  productId,
  stock,
  variantActive: true,
  productActive: true,
  ...extra,
});

/** Deterministic rng from a fixed sequence. */
const seq = (...xs: number[]) => {
  let i = 0;
  return () => xs[i++ % xs.length];
};

describe("productCandidates", () => {
  const cfg = { eligibleVariantIds: ["a1", "a2", "b1", "c1", "d1"], minStock: 5, weightCap: 1000 };

  it("includes only eligible, active, in-stock variants above the reserve", () => {
    const out = productCandidates(
      [
        v("a1", "A", 50),
        v("a2", "A", 10),
        v("b1", "B", 5), // at reserve → excluded
        v("c1", "C", 0), // out of stock
        v("d1", "D", 80, { productActive: false }), // inactive product
        v("x1", "X", 999), // not in the eligible list (e.g. sold-out mango / upcoming)
      ],
      cfg,
    );
    expect(out).toEqual([{ productId: "A", variantIds: ["a1", "a2"], weight: 45 + 5 }]);
  });

  it("excludes an inactive variant but keeps its active sibling", () => {
    const out = productCandidates([v("a1", "A", 50, { variantActive: false }), v("a2", "A", 25)], cfg);
    expect(out).toEqual([{ productId: "A", variantIds: ["a2"], weight: 20 }]);
  });

  it("weights by surplus stock and caps a single dominant product", () => {
    const out = productCandidates([v("a1", "A", 1005), v("b1", "B", 105)], { ...cfg, weightCap: 300 });
    expect(out.map((c) => [c.productId, c.weight])).toEqual([
      ["A", 300],
      ["B", 100],
    ]);
  });

  it("returns nothing when every eligible variant is low or out of stock", () => {
    expect(productCandidates([v("a1", "A", 3), v("b1", "B", 0)], cfg)).toEqual([]);
  });
});

describe("weightedPick / probabilities", () => {
  const items = [
    { id: "hi", weight: 300 },
    { id: "lo", weight: 100 },
    { id: "off", weight: 0 },
  ];

  it("maps the random draw onto cumulative weights", () => {
    expect(weightedPick(items, () => 0)?.id).toBe("hi");
    expect(weightedPick(items, () => 0.74)?.id).toBe("hi");
    expect(weightedPick(items, () => 0.76)?.id).toBe("lo");
    expect(weightedPick(items, () => 0.999999)?.id).toBe("lo");
  });

  it("never picks a zero-weight item and returns null when nothing is pickable", () => {
    for (let i = 0; i < 100; i++) expect(weightedPick(items, () => i / 100)?.id).not.toBe("off");
    expect(weightedPick([{ weight: 0 }], () => 0.5)).toBeNull();
    expect(weightedPick([], () => 0.5)).toBeNull();
  });

  it("probabilities follow the weights", () => {
    expect(probabilities(items)).toEqual([0.75, 0.25, 0]);
  });

  it("higher-stock products win proportionally more often over many draws", () => {
    const cands = productCandidates([v("a1", "A", 305), v("b1", "B", 105)], {
      eligibleVariantIds: ["a1", "b1"],
      minStock: 5,
      weightCap: 1000,
    });
    let a = 0;
    const N = 10_000;
    for (let i = 0; i < N; i++) if (weightedPick(cands, () => (i + 0.5) / N)?.productId === "A") a++;
    expect(a / N).toBeCloseTo(0.75, 2);
  });
});

describe("drawPrize", () => {
  const stock = [v("a1", "A", 50), v("b1", "B", 50)];
  const cfg = { eligibleVariantIds: ["a1", "b1"], minStock: 5, weightCap: 1000 };
  const tiers = [
    { percent: 5, weight: 1 },
    { percent: 20, weight: 1 },
  ];

  it("draws product and tier independently from the rng", () => {
    expect(drawPrize(stock, cfg, tiers, seq(0.1, 0.9))).toEqual({ percent: 20, productId: "A", variantIds: ["a1"] });
    expect(drawPrize(stock, cfg, tiers, seq(0.9, 0.1))).toEqual({ percent: 5, productId: "B", variantIds: ["b1"] });
  });

  it("returns null (no spin) when no product is in stock or no tier is enabled", () => {
    expect(drawPrize([v("a1", "A", 1)], cfg, tiers, seq(0.5))).toBeNull();
    expect(drawPrize(stock, cfg, [{ percent: 10, weight: 0 }], seq(0.5))).toBeNull();
  });
});
