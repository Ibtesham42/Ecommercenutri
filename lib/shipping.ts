/** Shipping rules shared by cart, checkout UI and server-side order pricing.
 *  Client-safe (no server-only imports) so it can be used in components. */

/** Orders at or above this subtotal (paise) ship free; otherwise a flat fee. */
export const FREE_SHIPPING_THRESHOLD = 49900; // ₹499
export const SHIPPING_FEE = 4900; // ₹49

export function shippingFor(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD || subtotal === 0 ? 0 : SHIPPING_FEE;
}
