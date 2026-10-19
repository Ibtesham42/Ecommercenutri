/**
 * Referral-cookie contract shared by the edge middleware, the /ref route and
 * checkout attribution. Edge- and client-safe: no Prisma, no Node APIs.
 *
 * The browser keeps the cookie for the longest window an admin can configure;
 * the real window (`StoreSetting.affiliateCookieDays`) is enforced server-side
 * against the click time in `nut_ref_at`, so changing the setting takes effect
 * immediately for every visitor.
 */

export const REF_COOKIE = "nut_ref";
export const REF_AT_COOKIE = "nut_ref_at";

/** Matches the `affiliateCookieDays` upper bound in the settings schema. */
export const REF_COOKIE_MAX_DAYS = 365;

export const REF_COOKIE_OPTIONS = {
  maxAge: 60 * 60 * 24 * REF_COOKIE_MAX_DAYS,
  path: "/",
  sameSite: "lax" as const,
};

/** Referral codes are generated lowercase; accept any casing someone types. */
export function normalizeRefCode(raw: string | null | undefined): string | null {
  if (!raw || !/^[A-Za-z0-9]{2,40}$/.test(raw)) return null;
  return raw.toLowerCase();
}

/** True when a click at `clickedAt` (epoch ms string) is inside the window.
 *  Cookies set before the timestamp existed (no value) were capped at 30 days
 *  by the browser, so they're accepted. */
export function withinRefWindow(clickedAt: string | null | undefined, days: number, now = Date.now()): boolean {
  if (!clickedAt) return true;
  const t = Number(clickedAt);
  if (!Number.isFinite(t) || t <= 0) return true;
  return now - t <= days * 86_400_000;
}
