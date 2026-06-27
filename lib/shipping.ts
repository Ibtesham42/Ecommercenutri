/** Default shipping rules. These are the fallbacks used when the store hasn't
 *  configured its own values (StoreSetting.defaultShippingFee /
 *  freeShippingThreshold). Client-safe (no server-only imports). The full
 *  GST + shipping math lives in `lib/pricing.ts`. */

/** Orders at or above this subtotal (paise) ship free by default. */
export const FREE_SHIPPING_THRESHOLD = 49900; // ₹499
export const SHIPPING_FEE = 4900; // ₹49

/** Default flat-rate shipping for a subtotal, using the built-in defaults.
 *  Prefer `computeShipping`/`computeBreakdown` in `lib/pricing.ts` with the
 *  store's configured settings — this is the keyless fallback. */
export function shippingFor(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_FEE;
}
