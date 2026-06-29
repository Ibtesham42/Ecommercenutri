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

/**
 * Validate a coupon for a given subtotal + user and return the discount.
 * Enforces active window, minimum order, total usage limit and per-user limit.
 */
export async function validateCoupon(
  rawCode: string,
  subtotal: number,
  userId: string,
  cart?: { productIds: string[]; categoryIds: string[] },
): Promise<CouponResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter a coupon code." };

  const coupon = await prisma.coupon.findUnique({ where: { code } });
  if (!coupon || !coupon.isActive) {
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
  if (coupon.minOrder && subtotal < coupon.minOrder) {
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
    const usedByUser = await prisma.order.count({
      where: {
        userId,
        couponId: coupon.id,
        paymentStatus: { in: ["PAID", "REFUNDED"] },
      },
    });
    if (usedByUser >= coupon.perUserLimit) {
      return { ok: false, error: "You've already used this coupon." };
    }
  }

  const discount = computeDiscount(coupon, subtotal);
  if (discount <= 0) {
    return { ok: false, error: "This coupon doesn't apply to your cart." };
  }
  return { ok: true, coupon, discount };
}
