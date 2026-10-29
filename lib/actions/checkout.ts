"use server";

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { mockCheckoutAllowed, razorpay, razorpayEnabled, verifyPaymentSignature } from "@/lib/razorpay";
import { siteConfig } from "@/config/site";
import { env } from "@/lib/env";
import { validateCoupon, type CouponLine } from "@/lib/coupons";
import { resolveAttribution } from "@/lib/affiliate/attribution";
import { recordCampaignConversion } from "@/lib/marketing/conversion";
import {
  computeBreakdown,
  computeShipping,
  isCodAvailable,
  type PriceBreakdown,
} from "@/lib/pricing";
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
  OrderFulfillmentError,
  type PricedLine,
} from "@/lib/orders";
import { orderFingerprint, placeOrderWithSingleUseOffer } from "@/lib/spin/checkout-guard";
import {
  applyCouponSchema,
  createOrderSchema,
  previewPricingSchema,
  verifyPaymentSchema,
} from "@/lib/validations/checkout";

export type CouponPreview =
  | { ok: true; code: string; discount: number; description: string | null }
  | { ok: false; error: string };

/** Cart context for coupon rules: product/category restrictions + the re-priced
 *  lines (line-scoped coupons discount only their eligible variants). */
async function cartContext(
  lines: PricedLine[],
): Promise<{ productIds: string[]; categoryIds: string[]; lines: CouponLine[] }> {
  const productIds = [...new Set(lines.map((l) => l.productId))];
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { categoryId: true },
  });
  return {
    productIds,
    categoryIds: [...new Set(products.map((p) => p.categoryId))],
    lines: lines.map((l) => ({
      variantId: l.variantId,
      unitPrice: l.unitPrice,
      listPrice: l.listPrice,
      quantity: l.quantity,
    })),
  };
}

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

  // Delivery fee counts toward the coupon's min-order (same rule as createOrder).
  const settings = await getPricingSettings();
  const shippingFee = computeShipping(priced.lines, priced.subtotal, settings).charge;

  const result = await validateCoupon(
    parsed.data.code,
    priced.subtotal,
    user.id,
    await cartContext(priced.lines),
    { shippingFee },
  );
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
  const shippingFee = computeShipping(priced.lines, priced.subtotal, settings).charge;

  // Optional coupon (only for signed-in users; the cart page has none).
  let discount = 0;
  let lineDiscounts: number[] | undefined;
  if (parsed.data.couponCode) {
    const user = await getCurrentUser();
    if (user) {
      const res = await validateCoupon(
        parsed.data.couponCode,
        priced.subtotal,
        user.id,
        await cartContext(priced.lines),
        { shippingFee },
      );
      if (res.ok) {
        discount = res.discount;
        lineDiscounts = res.lineDiscounts;
      }
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
    lineDiscounts,
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

type RazorpayCheckout = NonNullable<Extract<CreateOrderResult, { ok: true }>["razorpay"]>;

/** Payload for the client's Razorpay modal, branded with the store's logo, name and color. */
async function razorpayCheckout(o: {
  orderId: string;
  orderNumber: string;
  razorpayOrderId: string;
  amount: number;
  address: { fullName: string; phone: string };
  email: string;
}): Promise<RazorpayCheckout> {
  const store = await getStoreSettings();
  const brandLogo = cldRasterLogo(store.logo);
  return {
    keyId: env.razorpayKeyId,
    amount: o.amount,
    currency: "INR",
    razorpayOrderId: o.razorpayOrderId,
    orderId: o.orderId,
    name: store.siteName || siteConfig.name,
    description: `Order ${o.orderNumber}`,
    ...(brandLogo ? { image: brandLogo } : {}),
    themeColor: store.primaryColor || "#00835b",
    prefill: {
      name: o.address.fullName,
      email: o.email,
      contact: o.address.phone,
    },
  };
}

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

  if (paymentMethod !== "COD" && !razorpayEnabled && !mockCheckoutAllowed) {
    console.error("[checkout] Razorpay keys are missing on this deployment — refusing the mock payment flow.");
    return {
      ok: false,
      error: "Online payment is temporarily unavailable. Please choose Cash on Delivery or try again later.",
    };
  }

  // Re-price everything from the database.
  const priced = await priceCart(items);
  if (!priced.ok) return { ok: false, error: priced.error };

  // Address must belong to the current user.
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId: user.id },
  });
  if (!address) return { ok: false, error: "Select a valid delivery address." };

  // Cart product/category context (for coupon restrictions).
  const cart = await cartContext(priced.lines);

  // Store pricing + COD settings (also needed before the coupon: min-order
  // eligibility counts the delivery fee).
  const [pricingSettings, cod] = await Promise.all([
    getPricingSettings(),
    getCodSettings(),
  ]);
  const shippingFee = computeShipping(priced.lines, priced.subtotal, pricingSettings).charge;

  // Optional coupon.
  let discount = 0;
  let lineDiscounts: number[] | undefined;
  let couponId: string | null = null;
  let resolvedCouponCode: string | null = null;
  if (couponCode) {
    const result = await validateCoupon(couponCode, priced.subtotal, user.id, cart, {
      shippingFee,
    });
    if (!result.ok) return { ok: false, error: result.error };
    discount = result.discount;
    lineDiscounts = result.lineDiscounts;
    couponId = result.coupon.id;
    resolvedCouponCode = result.coupon.code;
  }

  // Affiliate attribution: the coupon's affiliate wins, else the last-click referral
  // cookie (self-referrals excluded). Persisted on the order; commission is created
  // at confirmation.
  const attribution = await resolveAttribution({ buyerUserId: user.id, couponId });

  // Compute shipping + (inclusive) GST + any COD fee authoritatively from the
  // re-priced lines and the store's settings — never trust client-sent totals.
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
    lineDiscounts,
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

  const orderData = {
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
    affiliateId: attribution?.affiliateId ?? null,
    referralCode: attribution?.referralCode ?? null,
    addressId: address.id,
    shippingAddress,
    notes: notes ?? null,
    items: {
      create: priced.lines.map((l, i) => ({
        productId: l.productId,
        variantId: l.variantId,
        productName: l.productName,
        variantLabel: l.variantLabel,
        image: l.image,
        price: l.unitPrice,
        quantity: l.quantity,
        // Spin & Win: this line's share of `discount` (drives its refund value).
        discount: lineDiscounts?.[i] ?? 0,
      })),
    },
  } satisfies Prisma.OrderUncheckedCreateInput;

  // `lineDiscounts` is set only for Spin & Win offers: single-use, so at most
  // one live order may hold one (see lib/spin/checkout-guard.ts). A retry of
  // the same online checkout reopens the existing payment instead.
  let order: { id: string };
  if (couponId && lineDiscounts) {
    const placed = await placeOrderWithSingleUseOffer({
      couponId,
      userId: user.id,
      paymentMethod,
      fingerprint: orderFingerprint({
        items: priced.lines.map((l) => ({ variantId: l.variantId, quantity: l.quantity, price: l.unitPrice })),
        total,
        addressId: address.id,
        paymentMethod,
      }),
      create: (tx) => tx.order.create({ data: orderData, select: { id: true } }),
    });
    if (placed.kind === "blocked") return { ok: false, error: placed.error };
    if (placed.kind === "reuse") {
      if (!(razorpayEnabled && razorpay)) {
        return { ok: false, error: "Couldn't start payment. Please try again." };
      }
      return {
        ok: true,
        orderNumber: placed.order.orderNumber,
        razorpay: await razorpayCheckout({
          orderId: placed.order.id,
          orderNumber: placed.order.orderNumber,
          razorpayOrderId: placed.order.razorpayOrderId,
          amount: placed.order.total,
          address,
          email: user.email ?? "",
        }),
      };
    }
    order = placed.order;
  } else {
    order = await prisma.order.create({ data: orderData, select: { id: true } });
  }

  // Credit a marketing campaign if the buyer arrived via a tracked campaign click.
  await recordCampaignConversion(user.id, total);

  // Cash on Delivery — place the order now (payment collected at delivery).
  // Confirm it (decrement stock, generate invoice, email) with payment PENDING.
  if (isCod) {
    try {
      await confirmOrder(order.id, { paymentStatus: "PENDING" });
    } catch (err) {
      // No payment was captured for COD — confirmOrder has already cancelled
      // the order and recorded why. Just surface a friendly message.
      if (err instanceof OrderFulfillmentError) {
        return { ok: false, error: err.message };
      }
      throw err;
    }
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
      return {
        ok: true,
        orderNumber,
        razorpay: await razorpayCheckout({
          orderId: order.id,
          orderNumber,
          razorpayOrderId: rzpOrder.id,
          amount: total,
          address,
          email: user.email ?? "",
        }),
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

  // …otherwise complete via the keyless mock flow. No real payment is taken
  // here either, so on failure it's safe to cancel outright, same as COD.
  try {
    await markOrderPaid(order.id);
  } catch (err) {
    if (err instanceof OrderFulfillmentError) {
      return { ok: false, error: err.message };
    }
    throw err;
  }
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

  try {
    await markOrderPaid(order.id, {
      paymentId: razorpayPaymentId,
      signature: razorpaySignature,
    });
  } catch (err) {
    if (err instanceof OrderFulfillmentError) {
      // Razorpay has already captured this payment. confirmOrder has
      // preserved the payment reference and flagged the order for manual
      // review instead of cancelling it or issuing any refund — never tell
      // the customer to "try again" here, that risks a second charge.
      return {
        ok: false,
        error:
          "Your payment was received, but we couldn't automatically confirm your order. Our team has been notified and will contact you shortly.",
      };
    }
    throw err;
  }
  return { ok: true, orderNumber: order.orderNumber };
}
