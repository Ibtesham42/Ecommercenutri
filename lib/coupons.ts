import type { Coupon } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CouponResult =
  | { ok: true; coupon: Coupon; discount: number }
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
  const eligible = new Set(coupon.variantIds);
  const scoped = lines.filter((l) => eligible.has(l.variantId) && l.quantity > 0);
  if (scoped.length === 0) return 0;
  const scopedTotal = scoped.reduce((s, l) => s + l.unitPrice * l.quantity, 0);

  let discount = 0;
  if (coupon.type === "FIXED") {
    discount = coupon.value;
  } else {
    for (const l of scoped) {
      const onSale = l.unitPrice < l.listPrice;
      let perUnit = 0;
      if (coupon.saleMode === "BEST_OF") {
        const offerUnit = l.listPrice - Math.round((l.listPrice * coupon.value) / 100);
        perUnit = Math.max(0, l.unitPrice - offerUnit);
      } else if (coupon.saleMode === "EXCLUDE") {
        perUnit = onSale ? 0 : Math.round((l.unitPrice * coupon.value) / 100);
      } else {
        perUnit = Math.round((l.unitPrice * coupon.value) / 100);
      }
      discount += perUnit * l.quantity;
    }
  }
  if (coupon.maxDiscount && discount > coupon.maxDiscount) discount = coupon.maxDiscount;
  return Math.max(0, Math.min(discount, scopedTotal));
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

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.isActive) {
    return { ok: false, error: "This coupon code is not valid." };
  }
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
    const scoped = lineScopedDiscount(coupon, lines);
    if (scoped <= 0) {
      return {
        ok: false,
        error: "The eligible items in your cart already carry a bigger discount than this offer.",
      };
    }
    return { ok: true, coupon, discount: Math.min(scoped, subtotal) };
  }

  const discount = computeDiscount(coupon, subtotal);
  if (discount <= 0) {
    return { ok: false, error: "This coupon doesn't apply to your cart." };
  }
  return { ok: true, coupon, discount };
}
