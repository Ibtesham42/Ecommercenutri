/** Pricing & tax engine — the single source of truth for GST + shipping math.
 *
 *  Client-safe (no server-only imports) so the cart, checkout, product page and
 *  the server-side order pricing (`lib/orders.ts` / `lib/actions/checkout.ts`)
 *  all agree on the numbers.
 *
 *  GST is INCLUSIVE: a product's listed price already contains GST at its rate,
 *  so the tax line is the component *extracted* from the price and the final
 *  payable total is unchanged by it (Indian retail norm — prices shown to the
 *  customer are tax-inclusive). Shipping is the *highest* per-product delivery
 *  charge across the cart (one shipment covers the order), free once the
 *  subtotal reaches the configured threshold. */

import { FREE_SHIPPING_THRESHOLD, SHIPPING_FEE } from "@/lib/shipping";

export type PricingSettings = {
  defaultGstRate: number; // percent applied when a product doesn't override
  defaultShippingFee: number; // paise, used when a product doesn't override
  freeShippingThreshold: number; // paise; subtotal at/above ships free (0 disables)
};

/** Keyless fallback used when store settings aren't available. */
export const PRICING_DEFAULTS: PricingSettings = {
  defaultGstRate: 0,
  defaultShippingFee: SHIPPING_FEE,
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
};

export type PricingLine = {
  unitPrice: number; // paise, GST-inclusive effective unit price
  quantity: number;
  gstRate?: number | null; // product GST override; null/undefined = store default
  deliveryCharge?: number | null; // paise product override; null/undefined = store default
};

export type PriceBreakdown = {
  subtotal: number; // paise, incl. GST
  discount: number; // paise
  tax: number; // paise, GST contained in the (post-discount) goods value
  shipping: number; // paise
  total: number; // paise payable
};

/** Effective GST percent for a line, falling back to the store default. */
export function resolveGstRate(
  rate: number | null | undefined,
  s: PricingSettings,
): number {
  const r = rate ?? s.defaultGstRate;
  return Number.isFinite(r) && r > 0 ? r : 0;
}

/** Effective delivery charge (paise) for a line, falling back to the default. */
export function resolveDeliveryCharge(
  charge: number | null | undefined,
  s: PricingSettings,
): number {
  const c = charge ?? s.defaultShippingFee;
  return Number.isFinite(c) && c > 0 ? c : 0;
}

/** GST component contained within a GST-inclusive amount at the given rate. */
export function gstWithin(amountInclusive: number, rate: number): number {
  if (rate <= 0 || amountInclusive <= 0) return 0;
  return Math.round((amountInclusive * rate) / (100 + rate));
}

/** Shipping for a cart: highest per-product delivery charge, free over threshold. */
export function computeShipping(
  lines: PricingLine[],
  subtotal: number,
  s: PricingSettings,
): number {
  if (subtotal <= 0) return 0;
  if (s.freeShippingThreshold > 0 && subtotal >= s.freeShippingThreshold) return 0;
  let max = 0;
  for (const l of lines) {
    const c = resolveDeliveryCharge(l.deliveryCharge, s);
    if (c > max) max = c;
  }
  return max;
}

/**
 * Full order breakdown from cart lines, store settings and an optional discount.
 * Inclusive GST: the tax shown is extracted from the discounted goods value and
 * summed per line, so a cart mixing different GST rates is handled correctly.
 */
export function computeBreakdown(
  lines: PricingLine[],
  s: PricingSettings,
  discount = 0,
): PriceBreakdown {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const safeDiscount = Math.min(Math.max(0, Math.round(discount)), subtotal);
  const shipping = computeShipping(lines, subtotal, s);

  const scale = subtotal > 0 ? (subtotal - safeDiscount) / subtotal : 0;
  let tax = 0;
  for (const l of lines) {
    const net = l.unitPrice * l.quantity * scale;
    tax += gstWithin(net, resolveGstRate(l.gstRate, s));
  }

  const total = Math.max(0, subtotal - safeDiscount + shipping);
  return { subtotal, discount: safeDiscount, tax, shipping, total };
}
