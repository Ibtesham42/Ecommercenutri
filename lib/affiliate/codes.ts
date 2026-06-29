import { customAlphabet } from "nanoid";
import { siteConfig } from "@/config/site";
import { prisma } from "@/lib/prisma";

const suffix = customAlphabet("23456789abcdefghjkmnpqrstuvwxyz", 4);

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFKD")
      .replace(/[^a-z0-9]+/g, "")
      .slice(0, 16) || "aff"
  );
}

/** Generate a unique, URL-safe referral code from a seed (name/email). */
export async function generateAffiliateCode(seed: string): Promise<string> {
  const base = slugify(seed);
  for (let i = 0; i < 6; i++) {
    const code = i === 0 ? base : `${base}${suffix()}`;
    const clash = await prisma.affiliate.findUnique({
      where: { code },
      select: { id: true },
    });
    if (!clash) return code;
  }
  return `${base}${suffix()}${suffix()}`;
}

/** Path-style referral link target. */
export function referralPath(code: string): string {
  return `/ref/${code}`;
}

/** Canonical shareable referral URL (query-style). */
export function referralUrl(code: string): string {
  return `${siteConfig.url}/?ref=${encodeURIComponent(code)}`;
}

/** Suggested coupon code from a name, e.g. "Ibtesham" → "IBTESHAM10". */
export function defaultCouponCode(seed: string, percent = 10): string {
  const base = seed.toUpperCase().replace(/[^A-Z0-9]+/g, "").slice(0, 12) || "NUTRI";
  return `${base}${percent}`;
}

const payoutId = customAlphabet("ACDEFGHJKLMNPQRSTUVWXYZ23456789", 6);

/** Human payout number, e.g. PO-260629-A1B2C3. */
export function generatePayoutNumber(): string {
  const d = new Date();
  const stamp = `${d.getFullYear().toString().slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `PO-${stamp}-${payoutId()}`;
}
