import { beforeEach, describe, expect, it, vi } from "vitest";
import { computeBreakdown, gstWithin, PRICING_DEFAULTS, type PricingSettings } from "@/lib/pricing";
import { returnDiscountShare, returnLineValue } from "@/lib/return-refund";

/**
 * Phase 2A — Spin & Win money maths: the spin discount belongs to its eligible
 * line for GST (taxable value) and for refunds; every other coupon keeps the
 * existing order-level behaviour. Prisma is mocked — no DB access.
 */

const prismaMock = {
  coupon: { findUnique: vi.fn() },
  order: { count: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));
const { validateCoupon, lineScopedAllocation, lineScopedDiscount } = await import("@/lib/coupons");

const BASE_COUPON = {
  id: "c1",
  code: "SPIN-ABCDEFGH",
  description: null,
  isActive: true,
  isPublic: false,
  type: "PERCENT" as "PERCENT" | "FIXED",
  value: 20,
  maxDiscount: null as number | null,
  minOrder: null as number | null,
  usageLimit: 1,
  usedCount: 0,
  perUserLimit: 1,
  productIds: [] as string[],
  categoryIds: [] as string[],
  variantIds: ["v_spin"],
  ownerUserId: "u1",
  saleMode: "STACK" as "BEST_OF" | "STACK" | "EXCLUDE",
  startsAt: null,
  expiresAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const settings: PricingSettings = { ...PRICING_DEFAULTS, defaultGstRate: 0, freeShippingEnabled: false, defaultShippingFee: 0 };

// ₹500 makhana @5% GST (the spin product) + ₹500 protein @18% GST.
const spinLine = { variantId: "v_spin", unitPrice: 25000, listPrice: 25000, quantity: 2 };
const otherLine = { variantId: "v_other", unitPrice: 50000, listPrice: 50000, quantity: 1 };
const pricing = [
  { unitPrice: 25000, quantity: 2, gstRate: 5 },
  { unitPrice: 50000, quantity: 1, gstRate: 18 },
];

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.order.count.mockResolvedValue(0);
});

describe("lineScopedAllocation", () => {
  it("puts the whole discount on the eligible line and sums to lineScopedDiscount", () => {
    const alloc = lineScopedAllocation(BASE_COUPON, [spinLine, otherLine]);
    expect(alloc).toEqual([10000, 0]);
    expect(alloc.reduce((a, b) => a + b, 0)).toBe(lineScopedDiscount(BASE_COUPON, [spinLine, otherLine]));
  });

  it("spreads a maxDiscount cap across eligible lines without losing a paisa", () => {
    const coupon = { ...BASE_COUPON, variantIds: ["a", "b", "c"], maxDiscount: 1001 };
    const lines = ["a", "b", "c"].map((v) => ({ variantId: v, unitPrice: 33333, listPrice: 33333, quantity: 1 }));
    const alloc = lineScopedAllocation(coupon, lines);
    expect(alloc.reduce((a, b) => a + b, 0)).toBe(1001);
    for (const d of alloc) expect(d).toBeGreaterThanOrEqual(333);
  });

  it("never gives a line more than its own value (FIXED larger than the line)", () => {
    const coupon = { ...BASE_COUPON, type: "FIXED" as const, value: 999999 };
    const alloc = lineScopedAllocation(coupon, [spinLine, otherLine]);
    expect(alloc).toEqual([50000, 0]);
  });
});

describe("validateCoupon — spin vs ordinary line-scoped coupons", () => {
  const cart = { productIds: [], categoryIds: [], lines: [spinLine, otherLine] };

  it("returns per-line discounts for a Spin & Win coupon", async () => {
    prismaMock.coupon.findUnique.mockResolvedValue({ ...BASE_COUPON, spinResult: { id: "s1" } });
    const res = await validateCoupon("SPIN-ABCDEFGH", 100000, "u1", cart);
    expect(res).toMatchObject({ ok: true, discount: 10000, lineDiscounts: [10000, 0] });
  });

  it("returns no per-line discounts for any coupon not linked to a spin", async () => {
    prismaMock.coupon.findUnique.mockResolvedValue({ ...BASE_COUPON, ownerUserId: null, spinResult: null });
    const res = await validateCoupon("SPIN-ABCDEFGH", 100000, "u1", cart);
    expect(res.ok && res.lineDiscounts).toBeUndefined();
    const whole = { ...BASE_COUPON, variantIds: [], ownerUserId: null, spinResult: null };
    prismaMock.coupon.findUnique.mockResolvedValue(whole);
    const res2 = await validateCoupon("SPIN-ABCDEFGH", 100000, "u1", cart);
    expect(res2).toMatchObject({ ok: true, discount: 20000 });
    expect(res2.ok && res2.lineDiscounts).toBeUndefined();
  });
});

describe("computeBreakdown — GST with mixed products and rates", () => {
  it("ordinary coupon: unchanged proportional treatment", () => {
    const b = computeBreakdown(pricing, settings, 10000);
    // 10% off every line's taxable value.
    expect(b.tax).toBe(gstWithin(45000, 5) + gstWithin(45000, 18));
    expect(b.total).toBe(90000);
  });

  it("spin coupon: only the eligible line's taxable value drops", () => {
    const b = computeBreakdown(pricing, settings, 10000, 0, [10000, 0]);
    expect(b.tax).toBe(gstWithin(40000, 5) + gstWithin(50000, 18));
    expect(b.total).toBe(90000); // what the customer pays is unchanged
    // A 5% item discounted instead of an 18% one → more GST stays on the 18% line.
    expect(b.tax).toBeGreaterThan(computeBreakdown(pricing, settings, 10000).tax);
  });

  it("spin discount on the higher-rate line lowers GST accordingly", () => {
    const b = computeBreakdown(pricing, settings, 10000, 0, [0, 10000]);
    expect(b.tax).toBe(gstWithin(50000, 5) + gstWithin(40000, 18));
  });

  it("falls back to proportional when the allocation is inconsistent", () => {
    const proportional = computeBreakdown(pricing, settings, 10000).tax;
    expect(computeBreakdown(pricing, settings, 10000, 0, [5000, 0]).tax).toBe(proportional); // wrong sum
    expect(computeBreakdown(pricing, settings, 10000, 0, [10000]).tax).toBe(proportional); // wrong length
    expect(computeBreakdown(pricing, settings, 60000, 0, [60000, 0]).tax).toBe(
      computeBreakdown(pricing, settings, 60000).tax,
    ); // exceeds the line's value
  });

  it("store-default GST rate applies to lines without an override", () => {
    const s = { ...settings, defaultGstRate: 12 };
    const lines = [{ unitPrice: 25000, quantity: 2 }, { unitPrice: 50000, quantity: 1, gstRate: 18 }];
    expect(computeBreakdown(lines, s, 10000, 0, [10000, 0]).tax).toBe(gstWithin(40000, 12) + gstWithin(50000, 18));
  });
});

describe("refunds for returned lines", () => {
  const line = { unitPrice: 25000, orderedQty: 3, lineDiscount: 10000 }; // ₹100 off over 3 units

  it("ordinary orders (no line discount) refund unit price × qty, as before", () => {
    expect(returnLineValue({ unitPrice: 25000, orderedQty: 3, lineDiscount: 0 }, 0, 2)).toBe(50000);
  });

  it("spin lines refund only what was paid, and partial returns add up exactly", () => {
    const first = returnLineValue(line, 0, 1);
    const second = returnLineValue(line, 1, 1);
    const third = returnLineValue(line, 2, 1);
    expect(first + second + third).toBe(75000 - 10000);
    expect([first, second, third].every((v) => v < 25000)).toBe(true);
    expect(returnLineValue(line, 0, 3)).toBe(65000);
  });

  it("can never refund more than paid, even with over-stated quantities", () => {
    expect(returnDiscountShare(line, 2, 5)).toBe(10000 - Math.round((10000 * 2) / 3));
    expect(returnLineValue(line, 0, 3) + returnLineValue(line, 3, 1)).toBeLessThanOrEqual(65000 + 25000);
  });
});
