import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { recordClick } from "@/lib/affiliate/clicks";
import {
  REF_AT_COOKIE,
  REF_COOKIE,
  REF_COOKIE_OPTIONS,
  normalizeRefCode,
} from "@/lib/affiliate/ref-cookie";

export const runtime = "nodejs";

/** Same-site path only: "/x" yes; "//host", "/\host" and absolute URLs never. */
function safeLandingPath(to: string | null): string {
  if (!to || !to.startsWith("/") || to.startsWith("//") || to.startsWith("/\\")) return "/";
  return to;
}

/**
 * Path-style referral entry (e.g. /ref/ibtesham). Records the click, sets the
 * attribution cookie, and redirects to the landing page (`?to=/products` etc.).
 */
export async function GET(req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const code = normalizeRefCode((await params).code);
  const to = safeLandingPath(req.nextUrl.searchParams.get("to"));
  const res = NextResponse.redirect(new URL(to, req.nextUrl.origin));
  if (!code) return res;

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

  res.cookies.set(REF_COOKIE, code, REF_COOKIE_OPTIONS);
  res.cookies.set(REF_AT_COOKIE, String(Date.now()), REF_COOKIE_OPTIONS);
  return res;
}
