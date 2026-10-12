import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Spin & Win coupon rules in the shared coupon engine: personal (owner-only)
 * coupons and line-scoped discounts. Prisma is mocked — no DB access.
 */

const prismaMock = {
  coupon: { findUnique: vi.fn() },
  order: { count: vi.fn() },
};
vi.mock("@/lib/prisma", () => ({ prisma: prismaMock }));

const { validateCoupon, lineScopedDiscount } = await import("@/lib/coupons");

const SPIN_COUPON = {
  id: "c_spin",
  code: "SPIN-ABCDEFGH",
  description: null,
  isActive: true,
  isPublic: false,
  type: "PERCENT" as const,
  value: 20,
  maxDiscount: null as number | null,
  minOrder: null as number | null,
  usageLimit: 1,
  usedCount: 0,
  perUserLimit: 1,
  productIds: ["p_makhana"],
  categoryIds: [] as string[],
  variantIds: ["v_eligible"],
  ownerUserId: "user_owner",
  saleMode: "BEST_OF" as "BEST_OF" | "STACK" | "EXCLUDE",
  startsAt: null as Date | null,
  expiresAt: null as Date | null,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const eligibleFull = { variantId: "v_eligible", unitPrice: 50000, listPrice: 50000, quantity: 1 }; // ₹500, no sale
const other = { variantId: "v_other", unitPrice: 30000, listPrice: 30000, quantity: 2 };
const cart = (lines: (typeof eligibleFull)[]) => ({ productIds: ["p_makhana"], categoryIds: [], lines });

beforeEach(() => {
  vi.clearAllMocks();
  prismaMock.coupon.findUnique.mockResolvedValue({ ...SPIN_COUPON });
  prismaMock.order.count.mockResolvedValue(0);
});

describe("lineScopedDiscount", () => {
  it("discounts only eligible lines (never the whole cart)", () => {
    expect(lineScopedDiscount(SPIN_COUPON, [eligibleFull, other])).toBe(10000); // 20% of ₹500 only
  });

  it("BEST_OF never stacks on a bigger existing sale", () => {
    const onSale30 = { ...eligibleFull, unitPrice: 35000 }; // already 30% off MRP
    expect(lineScopedDiscount({ ...SPIN_COUPON, saleMode: "BEST_OF" }, [onSale30])).toBe(0);
  });

  it("BEST_OF tops up a smaller sale to the offer price", () => {
    const onSale10 = { ...eligibleFull, unitPrice: 45000, quantity: 2 }; // 10% off; offer 20% → ₹400
    expect(lineScopedDiscount({ ...SPIN_COUPON, saleMode: "BEST_OF" }, [onSale10])).toBe(2 * 5000);
  });

  it("EXCLUDE gives nothing on sale lines; STACK applies on the sale price", () => {
    const onSale10 = { ...eligibleFull, unitPrice: 45000 };
    expect(lineScopedDiscount({ ...SPIN_COUPON, saleMode: "EXCLUDE" }, [onSale10])).toBe(0);
    expect(lineScopedDiscount({ ...SPIN_COUPON, saleMode: "STACK" }, [onSale10])).toBe(9000);
  });

  it("rounds per unit to whole paise and respects maxDiscount", () => {
    const odd = { variantId: "v_eligible", unitPrice: 19999, listPrice: 19999, quantity: 3 };
    // 15% of 19999 = 2999.85 → 3000 per unit
    expect(lineScopedDiscount({ ...SPIN_COUPON, value: 15, saleMode: "STACK" }, [odd])).toBe(9000);
    expect(lineScopedDiscount({ ...SPIN_COUPON, maxDiscount: 5000 }, [{ ...eligibleFull, quantity: 3 }])).toBe(5000);
  });
});

describe("validateCoupon — personal, line-scoped coupons", () => {
  it("applies for the owner with an eligible line", async () => {
    const res = await validateCoupon("spin-abcdefgh", 110000, "user_owner", cart([eligibleFull, other]));
    expect(res).toMatchObject({ ok: true, discount: 10000 });
  });

  it("is invisible to anyone but its owner (unauthorized redemption)", async () => {
    const res = await validateCoupon("SPIN-ABCDEFGH", 50000, "someone_else", cart([eligibleFull]));
    expect(res).toEqual({ ok: false, error: "This coupon code is not valid." });
  });

  it("explains when no eligible item is in the cart", async () => {
    const res = await validateCoupon("SPIN-ABCDEFGH", 60000, "user_owner", {
      productIds: ["p_makhana"],
      categoryIds: [],
      lines: [other],
    });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/selected products/i);
  });

  it("explains when the existing sale is already better", async () => {
    const res = await validateCoupon("SPIN-ABCDEFGH", 35000, "user_owner", cart([{ ...eligibleFull, unitPrice: 35000 }]));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/bigger discount/i);
  });

  it("rejects an expired offer", async () => {
    prismaMock.coupon.findUnique.mockResolvedValue({ ...SPIN_COUPON, expiresAt: new Date(Date.now() - 1000) });
    const res = await validateCoupon("SPIN-ABCDEFGH", 50000, "user_owner", cart([eligibleFull]));
    expect(res).toEqual({ ok: false, error: "This coupon has expired." });
  });

  it("rejects an already-redeemed offer (usage limit reached)", async () => {
    prismaMock.coupon.findUnique.mockResolvedValue({ ...SPIN_COUPON, usedCount: 1 });
    const res = await validateCoupon("SPIN-ABCDEFGH", 50000, "user_owner", cart([eligibleFull]));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/usage limit/i);
  });

  it("rejects reuse by the owner after a confirmed order (per-user limit)", async () => {
    prismaMock.order.count.mockResolvedValue(1);
    const res = await validateCoupon("SPIN-ABCDEFGH", 50000, "user_owner", cart([eligibleFull]));
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(/already used/i);
  });

  it("leaves ordinary (non-scoped) coupons on the whole-subtotal path", async () => {
    prismaMock.coupon.findUnique.mockResolvedValue({
      ...SPIN_COUPON,
      ownerUserId: null,
      variantIds: [],
      productIds: [],
      usageLimit: null,
      perUserLimit: null,
      value: 10,
    });
    const res = await validateCoupon("SAVE10", 100000, "anyone", cart([eligibleFull]));
    expect(res).toMatchObject({ ok: true, discount: 10000 });
  });
});
