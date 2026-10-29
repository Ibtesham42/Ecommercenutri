import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { resolveClickDestination } from "@/lib/marketing/click-destination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Click-tracking redirect: records a CLICK event, drops a `nut_campaign` cookie so a
 * resulting order can be credited as a conversion, then 302s to the destination.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const url = new URL(req.url);
  const userId = url.searchParams.get("u");
  const to = url.searchParams.get("to") || "/";
  const base = env.appUrl.replace(/\/$/, "");

  const campaign = await prisma.campaign
    .findUnique({ where: { id }, select: { id: true, ctaUrl: true } })
    .catch(() => null);

  // Same-origin destinations only — except the campaign's own admin-authored
  // CTA. Otherwise `?to=https://evil.example` (or `//evil.example`) would turn
  // this endpoint into an open redirect on our domain for phishing links.
  const dest = resolveClickDestination(to, base, campaign?.ctaUrl ?? null);

  if (campaign) {
    try {
      await prisma.$transaction([
        prisma.campaignEvent.create({
          data: { campaignId: id, userId: userId || null, type: "CLICK" },
        }),
        prisma.campaign.update({ where: { id }, data: { clickCount: { increment: 1 } } }),
      ]);
    } catch {
      // Unknown recipient id etc. — the redirect must still work.
    }
  }

  const res = NextResponse.redirect(dest);
  if (!campaign) return res;
  res.cookies.set("nut_campaign", id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7-day attribution window
    path: "/",
  });
  return res;
}
