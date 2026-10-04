import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Batch 1 (production-safety audit) — unit tests for the per-user coupon
 * limit bypass fix (lib/coupons.ts). Mocks Prisma entirely — no real
 * database connection or writes.
 */

const prismaMock = {
  coupon: { findUnique: vi.fn() },
  order: { count: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { validateCoupon, computeDiscount } = await import("@/lib/coupons");

const ACTIVE_COUPON = {
  id: "coupon_1",
  code: "SAVE10",
  isActive: true,
  type: "PERCENT" as const,
  value: 10,
  maxDiscount: null,
  minOrder: null,
  usageLimit: null,
  usedCount: 0,
  perUserLimit: 1,
  productIds: [] as string[],
  categoryIds: [] as string[],
  startsAt: null,
  expiresAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.coupon.findUnique.mockResolvedValue(ACTIVE_COUPON);
});

describe("validateCoupon — per-user limit bypass fix (fix #1)", () => {
  it("scenario 2: blocks reuse once a COD order has confirmed (stockDeducted=true) even though paymentStatus is still PENDING", async () => {
    // This is the exact bug: the old query only counted paymentStatus IN
    // (PAID, REFUNDED), which a confirmed-but-undelivered COD order never is.
    prismaMock.order.count.mockResolvedValue(1);

    const result = await validateCoupon("SAVE10", 10000, "user_1");

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/already used/i);

    // Prove the fix is actually in the query, not an accident of the mock:
    // the per-user count must include the stockDeducted clause so a COD
    // order that's confirmed-but-not-yet-PAID is counted.
    const where = prismaMock.order.count.mock.calls[0][0].where;
    expect(where.OR).toEqual(
      expect.arrayContaining([
        { stockDeducted: true },
        { paymentStatus: { in: ["PAID", "REFUNDED"] } },
      ]),
    );
  });

  it("does not block a user with no qualifying prior orders", async () => {
    prismaMock.order.count.mockResolvedValue(0);
    const result = await validateCoupon("SAVE10", 10000, "user_1");
    expect(result.ok).toBe(true);
  });

  it("scenario 4: a normal successful coupon validation computes the right discount", async () => {
    prismaMock.order.count.mockResolvedValue(0);
    const result = await validateCoupon("SAVE10", 10000, "user_1");
    expect(result).toEqual({ ok: true, coupon: ACTIVE_COUPON, discount: 1000 }); // 10% of 10000
  });

  it("still enforces the global usageLimit check unchanged", async () => {
    prismaMock.coupon.findUnique.mockResolvedValue({
      ...ACTIVE_COUPON,
      usageLimit: 5,
      usedCount: 5,
    });
    const result = await validateCoupon("SAVE10", 10000, "user_1");
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/usage limit/i);
    expect(prismaMock.order.count).not.toHaveBeenCalled(); // short-circuits before the per-user check
  });
});

describe("computeDiscount — unchanged pure logic (no regression)", () => {
  it("caps a PERCENT discount at maxDiscount", () => {
    const coupon = { type: "PERCENT" as const, value: 50, maxDiscount: 200 } as never;
    expect(computeDiscount(coupon, 1000)).toBe(200);
  });

  it("never discounts more than the subtotal", () => {
    const coupon = { type: "FIXED" as const, value: 5000, maxDiscount: null } as never;
    expect(computeDiscount(coupon, 1000)).toBe(1000);
  });
});
