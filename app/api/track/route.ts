import { NextResponse } from "next/server";
import { z } from "zod";
import type { UserEventType } from "@prisma/client";
import { getCurrentUser } from "@/lib/auth";
import { trackEvent } from "@/lib/recommendations/events";
import { checkRateLimit, limiters } from "@/lib/rate-limit";

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
] as const satisfies readonly UserEventType[];

const bodySchema = z.object({
  type: z.enum(CLIENT_EVENTS),
  productId: z.string().max(40).optional(),
  categoryId: z.string().max(40).optional(),
  query: z.string().max(200).optional(),
  source: z.string().max(60).optional(),
});

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

  // Anonymous, privacy-preserving id for signed-out shoppers (no PII).
  let anonId = req.headers
    .get("cookie")
    ?.match(/(?:^|;\s*)nut_anon=([^;]+)/)?.[1];
  let setCookie = false;
  if (!user && !anonId) {
    anonId = crypto.randomUUID();
    setCookie = true;
  }

  const id = user?.id ?? anonId ?? "anon";
  const rl = await checkRateLimit(limiters.api, `track:${id}`);
  if (!rl.success) return NextResponse.json({ ok: false }, { status: 429 });

  await trackEvent({
    type: parsed.data.type,
    userId: user?.id ?? null,
    anonId: user ? null : (anonId ?? null),
    productId: parsed.data.productId ?? null,
    categoryId: parsed.data.categoryId ?? null,
    query: parsed.data.query ?? null,
    source: parsed.data.source ?? null,
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
