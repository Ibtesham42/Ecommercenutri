import type { Coupon } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CouponResult =
  | {
      ok: true;
      coupon: Coupon;
      discount: number;
      /** Spin & Win only: `discount` split per `cart.lines` entry (index-aligned).
       *  GST and refunds attribute the discount to these lines; every other
       *  coupon keeps the order-level proportional treatment (undefined here). */
      lineDiscounts?: number[];
    }
  | { ok: false; error: string };

/**
 * Compute the discount (in paise) for a coupon against a subtotal.
 * Pure given a coupon record — used by both preview and order creation.
 */
export function computeDiscount(coupon: Coupon, subtotal: number): number {
  let discount =
    coupon.type === "PERCENT"
      ? Math.round((subtotal * coupon.value) / 100)
      : coupon.value;

  if (coupon.maxDiscount && discount > coupon.maxDiscount) {
    discount = coupon.maxDiscount;
  }
  // Never discount more than the order is worth.
  return Math.min(discount, subtotal);
}

/** A re-priced cart line, as the coupon engine needs it (all paise). */
export type CouponLine = {
  variantId: string;
  unitPrice: number; // effective price the customer pays (sale price if on sale)
  listPrice: number; // MRP (variant.price)
  quantity: number;
};

/**
 * Discount for a line-scoped coupon (`variantIds` non-empty): only lines of
 * those variants are discounted, per the coupon's `saleMode`:
 *   STACK   — percent off the current unit price.
 *   BEST_OF — the unit ends at min(sale price, MRP − percent); the discount is
 *             only the extra saving beyond the existing sale (never stacked).
 *   EXCLUDE — lines already below MRP get nothing.
 * Rounded per unit (so the per-item price shown is exact), then capped by
 * `maxDiscount`. FIXED line-scoped coupons spread nothing — they're applied
 * once if any eligible line is present.
 */
export function lineScopedDiscount(
  coupon: Pick<Coupon, "type" | "value" | "maxDiscount" | "variantIds" | "saleMode">,
  lines: readonly CouponLine[],
): number {
  return lineScopedAllocation(coupon, lines).reduce((s, d) => s + d, 0);
}

/**
 * The same discount as `lineScopedDiscount`, split per cart line (index-aligned
 * with `lines`; non-eligible lines get 0). Each line's share never exceeds what
 * that line earns on its own nor its value, and the shares always sum to the
 * capped total. When `maxDiscount` (or a FIXED amount) has to be spread, it's
 * split in proportion to each line's uncapped discount (FIXED: line value),
 * remainders going to the largest fractions — so the paise always add up.
 * Used for Spin & Win GST + refunds: the discount belongs to the eligible line.
 */
export function lineScopedAllocation(
  coupon: Pick<Coupon, "type" | "value" | "maxDiscount" | "variantIds" | "saleMode">,
  lines: readonly CouponLine[],
): number[] {
  const eligible = new Set(coupon.variantIds);
  const isScoped = (l: CouponLine) => eligible.has(l.variantId) && l.quantity > 0;
  const lineValue = (l: CouponLine) => l.unitPrice * l.quantity;
  const scopedTotal = lines.reduce((s, l) => s + (isScoped(l) ? lineValue(l) : 0), 0);
  if (scopedTotal <= 0) return lines.map(() => 0);

  // Uncapped per-line discount, and the weights a capped total is spread by.
  let raw: number[];
  let total: number;
  if (coupon.type === "FIXED") {
    raw = lines.map((l) => (isScoped(l) ? lineValue(l) : 0));
    total = coupon.value;
  } else {
    raw = lines.map((l) => {
      if (!isScoped(l)) return 0;
      let perUnit = 0;
      if (coupon.saleMode === "BEST_OF") {
        const offerUnit = l.listPrice - Math.round((l.listPrice * coupon.value) / 100);
        perUnit = Math.max(0, l.unitPrice - offerUnit);
      } else if (coupon.saleMode === "EXCLUDE") {
        perUnit = l.unitPrice < l.listPrice ? 0 : Math.round((l.unitPrice * coupon.value) / 100);
      } else {
        perUnit = Math.round((l.unitPrice * coupon.value) / 100);
      }
      return Math.min(perUnit, l.unitPrice) * l.quantity;
    });
    total = raw.reduce((s, d) => s + d, 0);
  }
  if (coupon.maxDiscount && total > coupon.maxDiscount) total = coupon.maxDiscount;
  total = Math.max(0, Math.min(total, scopedTotal));

  const weightSum = raw.reduce((s, d) => s + d, 0);
  if (coupon.type !== "FIXED" && total === weightSum) return raw;
  if (total === 0 || weightSum === 0) return lines.map(() => 0);

  // Largest-remainder split of `total` by `raw`.
  const exact = raw.map((w) => (total * w) / weightSum);
  const shares = exact.map(Math.floor);
  let left = total - shares.reduce((s, d) => s + d, 0);
  const order = exact
    .map((x, i) => ({ i, frac: x - Math.floor(x) }))
    .filter(({ i }) => raw[i] > 0)
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    shares[i] += 1;
    left -= 1;
  }
  return shares;
}

/**
 * Validate a coupon for a given subtotal + user and return the discount.
 * Enforces active window, minimum order, total usage limit and per-user limit.
 * Min-order eligibility counts the delivery fee (`opts.shippingFee`) the customer
 * will pay; the discount itself is still computed on the goods subtotal only.
 */
export async function validateCoupon(
  rawCode: string,
  subtotal: number,
  userId: string,
  cart?: { productIds: string[]; categoryIds: string[]; lines?: CouponLine[] },
  opts?: { shippingFee?: number },
): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a coupon code." };

  const found = await prisma.coupon.findUnique({
    where: { code },
    include: { spinResult: { select: { id: true } } },
  });
  if (!found || !found.isActive) {
    return { ok: false, error: "This coupon code is not valid." };
  }
  const { spinResult, ...coupon } = found;
  // Personal coupons (Spin & Win) redeem only for their owner. Same generic
  // message as an unknown code — never confirm someone else's code exists.
  if (coupon.ownerUserId && coupon.ownerUserId !== userId) {
    return { ok: false, error: "This coupon code is not valid." };
  }

  // Product/category restrictions (used by affiliate + targeted coupons). The cart
  // must contain at least one allowed product or a product in an allowed category.
  if (coupon.productIds.length > 0 || coupon.categoryIds.length > 0) {
    const pIds = cart?.productIds ?? [];
    const cIds = cart?.categoryIds ?? [];
    const matchProduct =
      coupon.productIds.length > 0 && coupon.productIds.some((id) => pIds.includes(id));
    const matchCategory =
      coupon.categoryIds.length > 0 && coupon.categoryIds.some((id) => cIds.includes(id));
    if (!matchProduct && !matchCategory) {
      return { ok: false, error: "This coupon doesn't apply to the items in your cart." };
    }
  }

  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now) {
    return { ok: false, error: "This coupon is not active yet." };
  }
  if (coupon.expiresAt && coupon.expiresAt < now) {
    return { ok: false, error: "This coupon has expired." };
  }
  // Min-order counts the delivery fee the customer actually pays (pre-discount
  // shipping; COD fee excluded — it's chosen after coupon entry).
  const orderValue = subtotal + (opts?.shippingFee ?? 0);
  if (coupon.minOrder && orderValue < coupon.minOrder) {
    return {
      ok: false,
      error: `Add more to your cart to use this coupon (min ₹${Math.ceil(
        coupon.minOrder / 100,
      )}).`,
    };
  }
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return { ok: false, error: "This coupon has reached its usage limit." };
  }
  if (coupon.perUserLimit !== null) {
    // `stockDeducted: true` is the same signal confirmOrder() uses to decide
    // the coupon has actually been consumed — it's set the moment an order is
    // confirmed, including COD orders that stay `paymentStatus: "PENDING"`
    // until delivery. Checking paymentStatus alone (PAID/REFUNDED) missed those,
    // letting a single-use coupon be reused across multiple COD orders before
    // any of them reached PAID. Keeping the original PAID/REFUNDED clause too
    // preserves counting a paid-then-refunded order as "used", same as before.
    const usedByUser = await prisma.order.count({
      where: {
        userId,
        couponId: coupon.id,
        OR: [{ paymentStatus: { in: ["PAID", "REFUNDED"] } }, { stockDeducted: true }],
      },
    });
    if (usedByUser >= coupon.perUserLimit) {
      return { ok: false, error: "You've already used this coupon." };
    }
  }

  // `?? []`: coupon objects shaped before this column existed (fixtures, old
  // cached rows) behave as whole-subtotal coupons, exactly as before.
  if ((coupon.variantIds ?? []).length > 0) {
    const lines = cart?.lines ?? [];
    const eligible = new Set(coupon.variantIds);
    if (!lines.some((l) => eligible.has(l.variantId))) {
      return {
        ok: false,
        error: "This offer applies only to selected products — add an eligible item to use it.",
      };
    }
    const allocation = lineScopedAllocation(coupon, lines);
    const scoped = allocation.reduce((s, d) => s + d, 0);
    if (scoped <= 0) {
      return {
        ok: false,
        error: "The eligible items in your cart already carry a bigger discount than this offer.",
      };
    }
    return {
      ok: true,
      coupon,
      discount: Math.min(scoped, subtotal),
      ...(spinResult ? { lineDiscounts: allocation } : {}),
    };
  }

  const discount = computeDiscount(coupon, subtotal);
  if (discount <= 0) {
    return { ok: false, error: "This coupon doesn't apply to your cart." };
  }
  return { ok: true, coupon, discount };
}
