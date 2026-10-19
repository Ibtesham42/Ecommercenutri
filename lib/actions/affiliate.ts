"use server";

import { revalidatePath } from "next/cache";
import type { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { applyAffiliateSchema, payoutDetailsSchema } from "@/lib/validations/affiliate";
import { generateAffiliateCode, generatePayoutNumber } from "@/lib/affiliate/codes";
import { affiliateBalances, matureCommissions } from "@/lib/affiliate/commissions";
import { getAffiliateSettings } from "@/lib/queries/settings";
import { formatPrice } from "@/lib/format";
import { appendPayoutAudit } from "@/lib/affiliate/payout-audit";

export type AffiliateActionResult = { ok: true } | { ok: false; error: string };

// Friendly labels so a validation failure names the field instead of the
// cryptic Zod default ("Invalid input" for a failed union / "Required").
const FIELD_LABELS: Record<string, string> = {
  role: "role",
  displayName: "display name",
  bio: "bio",
  website: "website",
  instagram: "Instagram handle",
  youtube: "YouTube channel",
  audienceSize: "audience size",
  pitch: "pitch",
  agree: "terms agreement",
  payoutMethod: "payout method",
  upiId: "UPI ID",
  bankName: "bank name",
  bankAccount: "bank account number",
  bankIfsc: "IFSC code",
  accountName: "account holder name",
};

/** Turn a ZodError into a real, human message (never a bare "Invalid input"). */
function firstZodError(error: ZodError, fallback = "Please check your details and try again."): string {
  const issue = error.issues[0];
  if (!issue) return fallback;
  const msg = issue.message?.trim() ?? "";
  const generic = ["invalid input", "required", "invalid"].includes(msg.toLowerCase());
  if (msg && !generic) return msg;
  const key = typeof issue.path[0] === "string" ? issue.path[0] : "";
  const label = FIELD_LABELS[key];
  return label ? `Please enter a valid ${label}.` : fallback;
}

/** Apply (or re-apply after rejection) to the affiliate program. */
export async function applyAffiliate(input: unknown): Promise<AffiliateActionResult> {
  const user = await getCurrentUser();
  if (!user?.id) return { ok: false, error: "Please sign in." };

  const settings = await getAffiliateSettings();
  if (!settings.affiliateEnabled) {
    return { ok: false, error: "The affiliate program isn't accepting applications right now." };
  }

  const parsed = applyAffiliateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error) };
  }
  const d = parsed.data;

  const existing = await prisma.affiliate.findUnique({
    where: { userId: user.id },
    select: { id: true, status: true },
  });
  if (existing && existing.status !== "REJECTED") {
    return { ok: false, error: "You already have an affiliate application." };
  }

  const socials = { instagram: d.instagram || null, youtube: d.youtube || null };
  const profile = {
    role: d.role,
    status: "PENDING" as const,
    displayName: d.displayName,
    bio: d.bio || null,
    website: d.website || null,
    socials,
    audienceSize: d.audienceSize ?? null,
    pitch: d.pitch || null,
    rejectionReason: null,
  };

  if (existing) {
    await prisma.affiliate.update({ where: { id: existing.id }, data: profile });
  } else {
    const code = await generateAffiliateCode(d.displayName || user.email || "aff");
    try {
      await prisma.affiliate.create({ data: { ...profile, userId: user.id, code } });
    } catch (err) {
      // A double-submit lost the race to its twin (userId / code are unique).
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        return { ok: false, error: "You already have an affiliate application." };
      }
      throw err;
    }
  }

  revalidatePath("/account/affiliate");
  revalidatePath("/admin/affiliates");
  return { ok: true };
}

/** Save the affiliate's payout details (UPI / bank). */
export async function updatePayoutDetails(input: unknown): Promise<AffiliateActionResult> {
  const user = await getCurrentUser();
  if (!user?.id) return { ok: false, error: "Please sign in." };

  const parsed = payoutDetailsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: firstZodError(parsed.error) };
  }
  const d = parsed.data;

  const res = await prisma.affiliate.updateMany({
    where: { userId: user.id },
    data: {
      payoutMethod: d.payoutMethod,
      upiId: d.upiId || null,
      bankName: d.bankName || null,
      bankAccount: d.bankAccount || null,
      bankIfsc: d.bankIfsc || null,
      accountName: d.accountName || null,
    },
  });
  if (res.count === 0) return { ok: false, error: "Affiliate account not found." };

  revalidatePath("/account/affiliate");
  return { ok: true };
}

class PayoutRaceLost extends Error {}

/** Request a payout of the available (approved, unpaid) commission balance. */
export async function requestPayout(): Promise<AffiliateActionResult> {
  const user = await getCurrentUser();
  if (!user?.id) return { ok: false, error: "Please sign in." };

  const aff = await prisma.affiliate.findUnique({
    where: { userId: user.id },
    select: { id: true, code: true, status: true, payoutMethod: true },
  });
  if (!aff || aff.status !== "APPROVED") {
    return { ok: false, error: "Your affiliate account isn't active." };
  }
  if (!aff.payoutMethod) {
    return { ok: false, error: "Add your payout details (UPI / bank) first." };
  }

  const open = await prisma.payout.findFirst({
    where: { affiliateId: aff.id, status: { in: ["REQUESTED", "APPROVED", "PROCESSING"] } },
    select: { id: true },
  });
  if (open) return { ok: false, error: "You already have a payout request in progress." };

  // Sweep matured commissions first so the balance is up to date.
  await matureCommissions();

  const settings = await getAffiliateSettings();
  const balances = await affiliateBalances(aff.id);
  if (balances.available < settings.affiliateMinPayout) {
    return {
      ok: false,
      error: `Minimum payout is ${formatPrice(settings.affiliateMinPayout)}. Your available balance is ${formatPrice(balances.available)}.`,
    };
  }

  // Claim the commissions and size the payout from what was actually claimed, in
  // one transaction. A concurrent request (double-tap, two tabs) blocks on the row
  // locks, re-evaluates `payoutId: null`, claims nothing and rolls back — so a
  // commission can never sit in two payouts, and the amount always matches.
  const claimed = await prisma.$transaction(async (tx) => {
    const payout = await tx.payout.create({
      data: {
        payoutNumber: generatePayoutNumber(),
        affiliateId: aff.id,
        amount: 0,
        status: "REQUESTED",
        method: aff.payoutMethod,
        notes: appendPayoutAudit(null, `affiliate ${aff.code}`, "Requested"),
      },
    });
    const res = await tx.commission.updateMany({
      where: { affiliateId: aff.id, status: "APPROVED", payoutId: null },
      data: { payoutId: payout.id },
    });
    const sum = await tx.commission.aggregate({
      where: { payoutId: payout.id },
      _sum: { amount: true },
    });
    const amount = sum._sum.amount ?? 0;
    if (res.count === 0 || amount < settings.affiliateMinPayout) throw new PayoutRaceLost();
    await tx.payout.update({ where: { id: payout.id }, data: { amount } });
    return amount;
  }).catch((err) => {
    if (err instanceof PayoutRaceLost) return null;
    throw err;
  });
  if (claimed == null) return { ok: false, error: "You already have a payout request in progress." };

  revalidatePath("/account/affiliate");
  revalidatePath("/admin/affiliates");
  revalidatePath("/admin/affiliates/payouts");
  return { ok: true };
}
