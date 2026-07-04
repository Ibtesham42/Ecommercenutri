import { NextResponse } from "next/server";
import { z } from "zod";
import type { UserEventType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { trackEvent } from "@/lib/recommendations/events";
import { checkRateLimit, limiters } from "@/lib/rate-limit";
import { parseUA } from "@/lib/ua";
import { requestGeo } from "@/lib/geo";
import { env } from "@/lib/env";

export const runtime = "nodejs";

const ANON_COOKIE = "nut_anon";

// Only behavioral signals the browser is allowed to report. Wishlist/purchase
// are recorded server-side from their authoritative actions, never trusted here.
const CLIENT_EVENTS = [
  "PRODUCT_VIEW",
  "CATEGORY_VIEW",
  "SEARCH",
  "CART_ADD",
  "RECO_CLICK",
  "CLICK",
  "PAGE_VIEW",
  "CHECKOUT_START",
  "HOME_VIEW",
  "PAYMENT_START",
  "RAGE_CLICK",
] as const satisfies readonly UserEventType[];

const bodySchema = z.object({
  type: z.enum(CLIENT_EVENTS),
  productId: z.string().max(40).optional(),
  categoryId: z.string().max(40).optional(),
  query: z.string().max(200).optional(),
  source: z.string().max(60).optional(),
  referrer: z.string().max(200).optional(),
  path: z.string().max(200).optional(),
  cid: z.string().regex(/^[a-f0-9-]{16,64}$/i).optional(),
});

/**
 * External referrer hostname only (lowercase, no www., no path/query — no PII).
 * The client already sends only cross-origin referrers; re-check here so a
 * crafted request can't pollute traffic sources with our own host.
 */
function externalReferrerHost(referrer: string | undefined): string | null {
  if (!referrer) return null;
  try {
    const host = new URL(referrer).hostname.toLowerCase().replace(/^www\./, "");
    const own = new URL(env.appUrl).hostname.toLowerCase().replace(/^www\./, "");
    return host && host !== own ? host : null;
  } catch {
    // Bare hostnames (no scheme) are fine too.
    const host = referrer.toLowerCase().replace(/^www\./, "").split("/")[0];
    return /^[a-z0-9.-]+\.[a-z]{2,}$/.test(host) ? host : null;
  }
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const user = await getCurrentUser();

  // Anonymous, privacy-preserving id for signed-out shoppers (no PII). Prefer
  // the durable client id (stable across concurrent first-load beacons); fall
  // back to the cookie, then mint one. Using the client id as the cookie value
  // too keeps the identity consistent for requests that omit the body id.
  const cookieAnon = req.headers.get("cookie")?.match(/(?:^|;\s*)nut_anon=([^;]+)/)?.[1];
  let anonId = parsed.data.cid ?? cookieAnon;
  let setCookie = false;
  if (!user && !anonId) {
    anonId = crypto.randomUUID();
  }
  // Persist the resolved anon id when it isn't already the cookie value, so
  // no-JS / cookie-only requests share the same identity.
  if (!user && anonId && anonId !== cookieAnon) {
    setCookie = true;
  }

  const id = user?.id ?? anonId ?? "anon";
  const rl = await checkRateLimit(limiters.api, `track:${id}`);
  if (!rl.success) return NextResponse.json({ ok: false }, { status: 429 });

  const { device } = parseUA(req.headers.get("user-agent") ?? "");
  const geo = requestGeo(req.headers);

  // Pathname only — strip any query/hash a crafted client might send.
  const path = parsed.data.path?.split(/[?#]/)[0] || null;

  await trackEvent({
    type: parsed.data.type,
    userId: user?.id ?? null,
    anonId: user ? null : (anonId ?? null),
    productId: parsed.data.productId ?? null,
    categoryId: parsed.data.categoryId ?? null,
    query: parsed.data.query ?? null,
    source: parsed.data.source ?? null,
    device,
    referrer:
      parsed.data.type === "PAGE_VIEW"
        ? externalReferrerHost(parsed.data.referrer)
        : null,
    path,
    city: geo.city,
    region: geo.region,
  });

  const res = NextResponse.json({ ok: true });
  if (setCookie && anonId) {
    res.cookies.set(ANON_COOKIE, anonId, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 365,
      path: "/",
    });
  }
  return res;
}
