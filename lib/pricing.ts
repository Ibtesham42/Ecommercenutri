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
  freeShippingThreshold: number; // paise; subtotal at/above ships free
  freeShippingEnabled: boolean; // master switch for the free-delivery rule
};

/** Keyless fallback used when store settings aren't available. */
export const PRICING_DEFAULTS: PricingSettings = {
  defaultGstRate: 0,
  defaultShippingFee: SHIPPING_FEE,
  freeShippingThreshold: FREE_SHIPPING_THRESHOLD,
  freeShippingEnabled: true,
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
  shipping: number; // paise (0 when free)
  shippingSaved: number; // paise waived by the free-delivery rule (else 0)
  codFee: number; // paise, Cash-on-Delivery handling fee (0 for online)
  total: number; // paise payable
};

/** Cash-on-Delivery availability config (subset of the store settings). */
export type CodAvailability = {
  codEnabled: boolean;
  codMinOrder: number | null; // paise
  codMaxOrder: number | null; // paise
};

/** Whether COD may be offered for a given goods subtotal (paise). Pure. */
export function isCodAvailable(subtotal: number, cod: CodAvailability): boolean {
  return (
    cod.codEnabled &&
    subtotal >= (cod.codMinOrder ?? 0) &&
    (cod.codMaxOrder == null || subtotal <= cod.codMaxOrder)
  );
}

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

/** The delivery charge that applies before the free-delivery rule: the highest
 *  per-product charge across the cart (product override → else default). */
export function deliveryChargeFor(
  lines: PricingLine[],
  s: PricingSettings,
): number {
  let max = 0;
  for (const l of lines) {
    const c = resolveDeliveryCharge(l.deliveryCharge, s);
    if (c > max) max = c;
  }
  return max;
}

/** Whether a subtotal qualifies for free delivery under the store's rule. */
export function qualifiesForFreeShipping(
  subtotal: number,
  s: PricingSettings,
): boolean {
  return (
    s.freeShippingEnabled &&
    s.freeShippingThreshold > 0 &&
    subtotal >= s.freeShippingThreshold
  );
}

/** Shipping for a cart: `{ charge, saved }`. `charge` is what the customer pays
 *  (0 when free); `saved` is the amount waived by the free-delivery rule. */
export function computeShipping(
  lines: PricingLine[],
  subtotal: number,
  s: PricingSettings,
): { charge: number; saved: number } {
  if (subtotal <= 0) return { charge: 0, saved: 0 };
  const base = deliveryChargeFor(lines, s);
  if (qualifiesForFreeShipping(subtotal, s)) return { charge: 0, saved: base };
  return { charge: base, saved: 0 };
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
  codFee = 0,
): PriceBreakdown {
  const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  const safeDiscount = Math.min(Math.max(0, Math.round(discount)), subtotal);
  const safeCodFee = Math.max(0, Math.round(codFee));
  const { charge: shipping, saved: shippingSaved } = computeShipping(lines, subtotal, s);

  const scale = subtotal > 0 ? (subtotal - safeDiscount) / subtotal : 0;
  let tax = 0;
  for (const l of lines) {
    const net = l.unitPrice * l.quantity * scale;
    tax += gstWithin(net, resolveGstRate(l.gstRate, s));
  }

  const total = Math.max(0, subtotal - safeDiscount + shipping + safeCodFee);
  return {
    subtotal,
    discount: safeDiscount,
    tax,
    shipping,
    shippingSaved,
    codFee: safeCodFee,
    total,
  };
}
