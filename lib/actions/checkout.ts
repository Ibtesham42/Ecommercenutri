"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { razorpay, razorpayEnabled, verifyPaymentSignature } from "@/lib/razorpay";
import { siteConfig } from "@/config/site";
import { env } from "@/lib/env";
import { validateCoupon } from "@/lib/coupons";
import { computeBreakdown, isCodAvailable, type PriceBreakdown } from "@/lib/pricing";
import {
  getPricingSettings,
  getCodSettings,
  getStoreSettings,
} from "@/lib/queries/settings";
import { cldRasterLogo } from "@/lib/cld";
import {
  priceCart,
  generateOrderNumber,
  markOrderPaid,
  confirmOrder,
} from "@/lib/orders";
import {
  applyCouponSchema,
  createOrderSchema,
  previewPricingSchema,
  verifyPaymentSchema,
} from "@/lib/validations/checkout";

export type CouponPreview =
  | { ok: true; code: string; discount: number; description: string | null }
  | { ok: false; error: string };

/** Live coupon preview shown on the checkout page (re-priced server-side). */
export async function applyCoupon(input: unknown): Promise<CouponPreview> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in to use a coupon." };

  const parsed = applyCouponSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid coupon." };
  }

  const priced = await priceCart(parsed.data.items);
  if (!priced.ok) return { ok: false, error: priced.error };

  const result = await validateCoupon(parsed.data.code, priced.subtotal, user.id);
  if (!result.ok) return { ok: false, error: result.error };

  return {
    ok: true,
    code: result.coupon.code,
    discount: result.discount,
    description: result.coupon.description,
  };
}

export type PricingPreview =
  | { ok: true; breakdown: PriceBreakdown; codAvailable: boolean; codFee: number }
  | { ok: false; error: string };

/**
 * Server-authoritative pricing for the cart/checkout summary. Re-prices the cart
 * from the database (fresh product delivery/GST) and computes the breakdown with
 * the store's current shipping settings — so the storefront never relies on
 * stale client/localStorage values. This is the single source of truth shared
 * with `createOrder`.
 */
export async function previewOrderPricing(input: unknown): Promise<PricingPreview> {
  const parsed = previewPricingSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid cart." };
  }

  const priced = await priceCart(parsed.data.items);
  if (!priced.ok) return { ok: false, error: priced.error };

  const [settings, cod] = await Promise.all([getPricingSettings(), getCodSettings()]);

  // Optional coupon (only for signed-in users; the cart page has none).
  let discount = 0;
  if (parsed.data.couponCode) {
    const user = await getCurrentUser();
    if (user) {
      const res = await validateCoupon(parsed.data.couponCode, priced.subtotal, user.id);
      if (res.ok) discount = res.discount;
    }
  }

  const codAvailable = isCodAvailable(priced.subtotal, cod);
  const codFee =
    parsed.data.paymentMethod === "COD" && codAvailable ? cod.codFee : 0;

  const breakdown = computeBreakdown(
    priced.lines.map((l) => ({
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      gstRate: l.gstRate,
      deliveryCharge: l.deliveryCharge,
    })),
    settings,
    discount,
    codFee,
  );
  return { ok: true, breakdown, codAvailable, codFee };
}

export type CreateOrderResult =
  | {
      ok: true;
      orderNumber: string;
      // Razorpay path — client opens the checkout modal with these.
      razorpay?: {
        keyId: string;
        amount: number;
        currency: string;
        razorpayOrderId: string;
        orderId: string;
        name: string;
        description: string;
        image?: string; // merchant logo shown in the checkout modal
        themeColor: string; // brand color for the checkout modal
        prefill: { name: string; email: string; contact: string };
      };
      // Mock path — already paid, just redirect to success.
      mock?: boolean;
      // COD path — order placed (payment pending), just redirect to success.
      cod?: boolean;
    }
  | { ok: false; error: string };

export async function createOrder(input: unknown): Promise<CreateOrderResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in to place an order." };

  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid order details.",
    };
  }
  const { items, addressId, couponCode, notes, paymentMethod } = parsed.data;

  // Re-price everything from the database.
  const priced = await priceCart(items);
  if (!priced.ok) return { ok: false, error: priced.error };

  // Address must belong to the current user.
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId: user.id },
  });
  if (!address) return { ok: false, error: "Select a valid delivery address." };

  // Optional coupon.
  let discount = 0;
  let couponId: string | null = null;
  let resolvedCouponCode: string | null = null;
  if (couponCode) {
    const result = await validateCoupon(couponCode, priced.subtotal, user.id);
    if (!result.ok) return { ok: false, error: result.error };
    discount = result.discount;
    couponId = result.coupon.id;
    resolvedCouponCode = result.coupon.code;
  }

  // Compute shipping + (inclusive) GST + any COD fee authoritatively from the
  // re-priced lines and the store's settings — never trust client-sent totals.
  const [pricingSettings, cod] = await Promise.all([
    getPricingSettings(),
    getCodSettings(),
  ]);

  const isCod = paymentMethod === "COD";
  if (isCod && !isCodAvailable(priced.subtotal, cod)) {
    return { ok: false, error: "Cash on Delivery isn't available for this order." };
  }
  const codFee = isCod ? cod.codFee : 0;

  const breakdown = computeBreakdown(
    priced.lines.map((l) => ({
      unitPrice: l.unitPrice,
      quantity: l.quantity,
      gstRate: l.gstRate,
      deliveryCharge: l.deliveryCharge,
    })),
    pricingSettings,
    discount,
    codFee,
  );
  const shipping = breakdown.shipping;
  const shippingSaved = breakdown.shippingSaved;
  const tax = breakdown.tax;
  const total = breakdown.total;
  const orderNumber = generateOrderNumber();

  const shippingAddress = {
    fullName: address.fullName,
    phone: address.phone,
    line1: address.line1,
    line2: address.line2,
    city: address.city,
    state: address.state,
    pincode: address.pincode,
    country: address.country,
  };

  const order = await prisma.order.create({
    data: {
      orderNumber,
      userId: user.id,
      status: "PENDING",
      paymentStatus: "PENDING",
      paymentMethod,
      subtotal: priced.subtotal,
      discount,
      shipping,
      shippingSaved,
      codFee,
      tax,
      total,
      couponId,
      couponCode: resolvedCouponCode,
      addressId: address.id,
      shippingAddress,
      notes: notes ?? null,
      items: {
        create: priced.lines.map((l) => ({
          productId: l.productId,
          variantId: l.variantId,
          productName: l.productName,
          variantLabel: l.variantLabel,
          image: l.image,
          price: l.unitPrice,
          quantity: l.quantity,
        })),
      },
    },
  });

  // Cash on Delivery — place the order now (payment collected at delivery).
  // Confirm it (decrement stock, generate invoice, email) with payment PENDING.
  if (isCod) {
    await confirmOrder(order.id, { paymentStatus: "PENDING" });
    return { ok: true, orderNumber, cod: true };
  }

  // Live payments via Razorpay when configured…
  if (razorpayEnabled && razorpay) {
    try {
      const rzpOrder = await razorpay.orders.create({
        amount: total,
        currency: "INR",
        receipt: orderNumber,
        notes: { orderId: order.id, userId: user.id },
      });
      await prisma.order.update({
        where: { id: order.id },
        data: { razorpayOrderId: rzpOrder.id },
      });
      // Brand the checkout modal with the store's logo, name and color.
      const store = await getStoreSettings();
      const brandLogo = cldRasterLogo(store.logo);
      return {
        ok: true,
        orderNumber,
        razorpay: {
          keyId: env.razorpayKeyId,
          amount: total,
          currency: "INR",
          razorpayOrderId: rzpOrder.id,
          orderId: order.id,
          name: store.siteName || siteConfig.name,
          description: `Order ${orderNumber}`,
          ...(brandLogo ? { image: brandLogo } : {}),
          themeColor: store.primaryColor || "#16803c",
          prefill: {
            name: address.fullName,
            email: user.email ?? "",
            contact: address.phone,
          },
        },
      };
    } catch (err) {
      console.error("[checkout] Razorpay order failed:", err);
      await prisma.order.update({
        where: { id: order.id },
        data: { status: "CANCELLED", paymentStatus: "FAILED" },
      });
      return { ok: false, error: "Couldn't start payment. Please try again." };
    }
  }

  // …otherwise complete via the keyless mock flow.
  await markOrderPaid(order.id);
  return { ok: true, orderNumber, mock: true };
}

export type VerifyPaymentResult =
  | { ok: true; orderNumber: string }
  | { ok: false; error: string };

export async function verifyPayment(input: unknown): Promise<VerifyPaymentResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Please sign in." };

  const parsed = verifyPaymentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid payment data." };
  const { orderId, razorpayOrderId, razorpayPaymentId, razorpaySignature } =
    parsed.data;

  const valid = verifyPaymentSignature(
    razorpayOrderId,
    razorpayPaymentId,
    razorpaySignature,
  );
  if (!valid) return { ok: false, error: "Payment could not be verified." };

  const order = await prisma.order.findFirst({
    where: { id: orderId, userId: user.id, razorpayOrderId },
  });
  if (!order) return { ok: false, error: "Order not found." };

  await markOrderPaid(order.id, {
    paymentId: razorpayPaymentId,
    signature: razorpaySignature,
  });
  return { ok: true, orderNumber: order.orderNumber };
}
