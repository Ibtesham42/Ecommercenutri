import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";

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

  // Resolve the destination (relative path or admin-authored absolute URL).
  let dest: string;
  try {
    dest = /^https?:\/\//i.test(to) ? new URL(to).toString() : new URL(to, base).toString();
  } catch {
    dest = base;
  }

  try {
    await prisma.$transaction([
      prisma.campaignEvent.create({
        data: { campaignId: id, userId: userId || null, type: "CLICK" },
      }),
      prisma.campaign.update({ where: { id }, data: { clickCount: { increment: 1 } } }),
    ]);
  } catch {
    // Unknown campaign — still redirect.
  }

  const res = NextResponse.redirect(dest);
  res.cookies.set("nut_campaign", id, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7, // 7-day attribution window
    path: "/",
  });
  return res;
}
