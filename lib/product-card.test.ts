import { describe, it, expect } from "vitest";
import { productCardView } from "@/lib/product-card";

const v = (weightLabel: string, price: number, discountPrice: number | null, stock: number, isDefault = false) => ({
  weightLabel,
  price,
  discountPrice,
  stock,
  isDefault,
});

describe("productCardView", () => {
  it("shows a single variant's real price, MRP and discount", () => {
    const view = productCardView({ isBestSeller: false, variants: [v("100g", 17500, 9900, 40, true)] });
    expect(view).toMatchObject({ price: 9900, mrp: 17500, off: 43, fromPrice: false, sizeLabel: "100g", badge: null });
  });

  it("never shows an MRP or discount without a genuine one", () => {
    const view = productCardView({ isBestSeller: false, variants: [v("1kg", 50000, null, 9, true)] });
    expect(view).toMatchObject({ price: 50000, mrp: null, off: null });
    expect(productCardView({ isBestSeller: false, variants: [v("1kg", 500, 600, 9, true)] }).mrp).toBeNull();
  });

  it("pairs the 'From' price with the MRP of the SAME (cheapest) size", () => {
    // Default is the 200g pack; the cheapest is 100g — MRP must be 100g's, not 200g's.
    const view = productCardView({
      isBestSeller: false,
      variants: [v("200 gm", 45800, 24900, 2, true), v("100g", 22900, 12500, 6)],
    });
    expect(view).toMatchObject({ price: 12500, mrp: 22900, off: 45, fromPrice: true, sizeLabel: "200 gm · 100g" });
  });

  it("summarises many sizes", () => {
    const sizes = ["50g", "100g", "250g", "500g"].map((w, i) => v(w, 1000 * (i + 1), null, 10, i === 0));
    expect(productCardView({ isBestSeller: false, variants: sizes }).sizeLabel).toBe("4 sizes");
  });

  it("shows at most one badge: sold out beats bestseller, bestseller can be suppressed", () => {
    expect(productCardView({ isBestSeller: true, variants: [v("80g", 249, 199, 0, true)] }).badge).toBe("soldOut");
    expect(productCardView({ isBestSeller: true, variants: [v("80g", 249, 199, 5, true)] }).badge).toBe("bestSeller");
    expect(
      productCardView({ isBestSeller: true, variants: [v("80g", 249, 199, 5, true)] }, { showBestSeller: false }).badge,
    ).toBeNull();
  });

  it("reports low stock only from real stock, never when sold out", () => {
    expect(productCardView({ isBestSeller: false, variants: [v("80g", 249, null, 3, true)] }).lowStock).toBe(3);
    expect(productCardView({ isBestSeller: false, variants: [v("80g", 249, null, 6, true)] }).lowStock).toBeNull();
    const soldOut = productCardView({ isBestSeller: false, variants: [v("80g", 249, null, 0, true)] });
    expect(soldOut).toMatchObject({ outOfStock: true, lowStock: null });
  });
});
