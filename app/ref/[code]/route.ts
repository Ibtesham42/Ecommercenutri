import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordClick } from "@/lib/affiliate/clicks";
import { REF_COOKIE } from "@/lib/affiliate/attribution";

export const runtime = "nodejs";

/**
 * Path-style referral entry (e.g. /ref/ibtesham). Records the click, sets the
 * attribution cookie, and redirects to the landing page (`?to=/products` etc.).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const toParam = req.nextUrl.searchParams.get("to");
  const to = toParam && toParam.startsWith("/") ? toParam : "/";

  const anonId = req.cookies.get("nut_anon")?.value ?? null;
  const user = await getCurrentUser();

  await recordClick({
    code,
    anonId,
    userId: user?.id ?? null,
    landingPath: to,
    referrer: req.headers.get("referer"),
    userAgent: req.headers.get("user-agent"),
    ip: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
  });

  const res = NextResponse.redirect(new URL(to, req.nextUrl.origin));
  res.cookies.set(REF_COOKIE, code, {
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
    sameSite: "lax",
  });
  return res;
}
