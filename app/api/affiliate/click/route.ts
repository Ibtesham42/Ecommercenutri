import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { recordClick } from "@/lib/affiliate/clicks";
import { checkRateLimit, limiters } from "@/lib/rate-limit";

export const runtime = "nodejs";

const bodySchema = z.object({
  code: z.string().min(1).max(40),
  landingPath: z.string().max(200).optional(),
  referrer: z.string().max(200).optional(),
});

/** Beacon endpoint: logs a referral click for a `?ref=` visit (cookie set by
 *  middleware; the client beacon posts the code here once per session). */
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const anonId = req.headers.get("cookie")?.match(/(?:^|;\s*)nut_anon=([^;]+)/)?.[1] ?? null;
  const user = await getCurrentUser();
  const id = user?.id ?? anonId ?? "anon";
  const rl = await checkRateLimit(limiters.api, `affclick:${id}`);
  if (!rl.success) return NextResponse.json({ ok: false }, { status: 429 });

  await recordClick({
    code: parsed.data.code,
    anonId,
    userId: user?.id ?? null,
    landingPath: parsed.data.landingPath ?? "/",
    referrer: parsed.data.referrer ?? req.headers.get("referer"),
    userAgent: req.headers.get("user-agent"),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  return NextResponse.json({ ok: true });
}
