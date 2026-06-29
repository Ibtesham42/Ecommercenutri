import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";

const { auth } = NextAuth(authConfig);

const securityHeaders: Record<string, string> = {
  "X-DNS-Prefetch-Control": "on",
  "X-Frame-Options": "SAMEORIGIN",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  // HSTS (browsers ignore it over plain HTTP, so it's safe in dev).
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  // Anti-clickjacking, complements X-Frame-Options without affecting scripts/styles.
  "Content-Security-Policy": "frame-ancestors 'self'",
  "X-Permitted-Cross-Domain-Policies": "none",
};

function withSecurityHeaders(res: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(securityHeaders)) {
    res.headers.set(key, value);
  }
  return res;
}

export default auth((req) => {
  const { nextUrl } = req;
  const path = nextUrl.pathname;
  const isLoggedIn = Boolean(req.auth);
  const role = req.auth?.user?.role;

  // Affiliate referral capture: persist `?ref=<code>` into the nut_ref cookie (edge,
  // cookie-only — the click row is logged by the client beacon / the /ref route).
  const ref = nextUrl.searchParams.get("ref");
  const finalize = (res: NextResponse): NextResponse => {
    if (ref && /^[A-Za-z0-9]{2,40}$/.test(ref)) {
      res.cookies.set("nut_ref", ref, {
        maxAge: 60 * 60 * 24 * 30, // 30-day attribution window
        path: "/",
        sameSite: "lax",
      });
    }
    return withSecurityHeaders(res);
  };

  // Admin area — must be a logged-in admin (sub-admin or main admin).
  // Per-section permissions are enforced server-side (layout + pages + actions).
  if (path.startsWith("/admin")) {
    if (!isLoggedIn) {
      const url = new URL("/login", nextUrl);
      url.searchParams.set("callbackUrl", path);
      return finalize(NextResponse.redirect(url));
    }
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return finalize(NextResponse.redirect(new URL("/", nextUrl)));
    }
  }

  // Account area — must be logged in.
  if (path.startsWith("/account")) {
    if (!isLoggedIn) {
      const url = new URL("/login", nextUrl);
      url.searchParams.set("callbackUrl", path);
      return finalize(NextResponse.redirect(url));
    }
  }

  return finalize(NextResponse.next());
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|txt|xml|webmanifest)$).*)",
  ],
};
