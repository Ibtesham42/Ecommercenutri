import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";

function parseUA(ua: string): { device: string; browser: string } {
  const u = ua.toLowerCase();
  const device = /mobile|iphone|ipod/.test(u)
    ? "mobile"
    : /ipad|tablet/.test(u)
      ? "tablet"
      : /android/.test(u) && !/mobile/.test(u)
        ? "tablet"
        : /android/.test(u)
          ? "mobile"
          : "desktop";
  const browser = /edg\//.test(u)
    ? "Edge"
    : /chrome|crios/.test(u)
      ? "Chrome"
      : /firefox|fxios/.test(u)
        ? "Firefox"
        : /safari/.test(u)
          ? "Safari"
          : "Other";
  return { device, browser };
}

function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(ip).digest("hex").slice(0, 32);
}

/**
 * Record a referral click. Best-effort. Fraud guards: dedupes per
 * [affiliate, anon] within 24h, and ignores the affiliate's own (logged-in)
 * clicks. Stores only a hashed IP — no raw PII.
 */
export async function recordClick(input: {
  code: string;
  anonId?: string | null;
  userId?: string | null;
  landingPath: string;
  referrer?: string | null;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<void> {
  try {
    const aff = await prisma.affiliate.findFirst({
      where: { code: input.code, status: "APPROVED" },
      select: { id: true, userId: true },
    });
    if (!aff) return;
    if (input.userId && input.userId === aff.userId) return; // self-click

    if (input.anonId) {
      const since = new Date(Date.now() - 24 * 3600 * 1000);
      const dup = await prisma.affiliateClick.findFirst({
        where: { affiliateId: aff.id, anonId: input.anonId, createdAt: { gte: since } },
        select: { id: true },
      });
      if (dup) return;
    }

    const { device, browser } = parseUA(input.userAgent ?? "");
    await prisma.affiliateClick.create({
      data: {
        affiliateId: aff.id,
        anonId: input.anonId ?? null,
        userId: input.userId ?? null,
        landingPath: input.landingPath.slice(0, 200),
        referrer: input.referrer?.slice(0, 200) ?? null,
        device,
        browser,
        ipHash: hashIp(input.ip),
      },
    });
  } catch (err) {
    console.error("[affiliate] recordClick failed:", err);
  }
}
