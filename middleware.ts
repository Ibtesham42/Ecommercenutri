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

  // Admin area — must be a logged-in admin (sub-admin or main admin).
  // Per-section permissions are enforced server-side (layout + pages + actions).
  if (path.startsWith("/admin")) {
    if (!isLoggedIn) {
      const url = new URL("/login", nextUrl);
      url.searchParams.set("callbackUrl", path);
      return withSecurityHeaders(NextResponse.redirect(url));
    }
    if (role !== "ADMIN" && role !== "SUPER_ADMIN") {
      return withSecurityHeaders(NextResponse.redirect(new URL("/", nextUrl)));
    }
  }

  // Account area — must be logged in.
  if (path.startsWith("/account")) {
    if (!isLoggedIn) {
      const url = new URL("/login", nextUrl);
      url.searchParams.set("callbackUrl", path);
      return withSecurityHeaders(NextResponse.redirect(url));
    }
  }

  return withSecurityHeaders(NextResponse.next());
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|css|js|txt|xml|webmanifest)$).*)",
  ],
};
