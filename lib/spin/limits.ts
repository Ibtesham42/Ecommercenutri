import { createHash } from "node:crypto";

/**
 * Daily caps on NEW anonymous spins (server-enforced via Upstash, see
 * lib/rate-limit.ts). Signed-in spins are bounded by the DB instead: one spin
 * per account per campaign.
 */
export const SPINS_PER_IP_PER_DAY = 50; // generous: mobile carriers share IPs (CGNAT)
export const SPINS_PER_BROWSER_PER_DAY = 3;

// Same shape the browser mints for `nut_cid`/`nut_anon` (a random UUID).
const ANON_ID_RE = /^[a-f0-9-]{16,64}$/i;

/**
 * Rate-limit key for "this browser". A well-formed anonymous id (random UUID,
 * no personal data) identifies the browser; a missing or malformed one must
 * not escape the limit, so it falls back to a one-way hash of IP + user agent
 * — used only as an expiring limiter key, never stored with the spin.
 */
export function browserLimitKey(anonId: string | null, ip: string, userAgent: string): string {
  if (anonId && ANON_ID_RE.test(anonId)) return `anon:${anonId}`;
  return `fp:${createHash("sha256").update(`${ip}|${userAgent}`).digest("hex").slice(0, 32)}`;
}
