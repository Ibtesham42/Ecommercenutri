/**
 * Durable, privacy-preserving client identity for analytics.
 *
 * WHY: the server used to mint an anonymous id and set an httpOnly cookie on the
 * first tracked request. On a fresh visit several beacons fire almost at once
 * (page view, product view, home view…) before that Set-Cookie round-trips, so
 * each request generated a DIFFERENT id — splitting one real shopper into many
 * "sessions" and destroying funnel accuracy. Minting the id here, synchronously
 * in localStorage, means every beacon from this browser shares one stable id
 * from the very first event.
 *
 * It is a random UUID (no PII), persists across sessions so returning shoppers
 * are recognized, and degrades to "" when storage is unavailable (private mode)
 * — the server then falls back to its cookie id.
 */

const KEY = "nut_cid";

let cached: string | null = null;

export function getClientId(): string {
  if (cached) return cached;
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(KEY);
    if (!id || !/^[a-f0-9-]{16,64}$/i.test(id)) {
      id = crypto.randomUUID();
      window.localStorage.setItem(KEY, id);
    }
    cached = id;
    return id;
  } catch {
    return ""; // private mode / storage blocked — server falls back to its cookie
  }
}
