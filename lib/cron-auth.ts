import "server-only";
import { timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

/**
 * Shared guard for the cron endpoints (/api/cron/*). They do real, expensive,
 * outward-facing work — dispatching campaigns to the whole subscriber list,
 * publishing to Instagram, spending AI tokens — so authorization must fail
 * CLOSED in production.
 *
 * Dev/preview convenience (triggering a cron by hand with no secret set) is
 * kept for non-production only. Without this, a preview deployment that is
 * missing CRON_SECRET would expose an unauthenticated mass-mail trigger
 * against the production database.
 *
 * Returns a Response to send back, or null when the caller is authorized.
 */
export function guardCron(req: Request, name: string): NextResponse | null {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        `[cron/${name}] CRON_SECRET is not set — refusing to run. Set it on the deployment and in the caller.`,
      );
      return NextResponse.json(
        { ok: false, error: "Cron is not configured on this deployment." },
        { status: 503 },
      );
    }
    return null; // dev: open, so it can be triggered by hand
  }

  const header = req.headers.get("authorization") ?? "";
  if (!safeEqual(header, `Bearer ${secret}`)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  try {
    return timingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
