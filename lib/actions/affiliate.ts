"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { applyAffiliateSchema, payoutDetailsSchema } from "@/lib/validations/affiliate";
import { generateAffiliateCode, generatePayoutNumber } from "@/lib/affiliate/codes";
import { affiliateBalances, matureCommissions } from "@/lib/affiliate/commissions";
import { getAffiliateSettings } from "@/lib/queries/settings";
import { formatPrice } from "@/lib/format";

export type AffiliateActionResult = { ok: true } | { ok: false; error: string };

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
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid application." };
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
    await prisma.affiliate.create({ data: { ...profile, userId: user.id, code } });
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
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details." };
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

/** Request a payout of the available (approved, unpaid) commission balance. */
export async function requestPayout(): Promise<AffiliateActionResult> {
  const user = await getCurrentUser();
  if (!user?.id) return { ok: false, error: "Please sign in." };

  const aff = await prisma.affiliate.findUnique({
    where: { userId: user.id },
    select: { id: true, status: true, payoutMethod: true },
  });
  if (!aff || aff.status !== "APPROVED") {
    return { ok: false, error: "Your affiliate account isn't active." };
  }
  if (!aff.payoutMethod) {
    return { ok: false, error: "Add your payout details (UPI / bank) first." };
  }

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

  const commissions = await prisma.commission.findMany({
    where: { affiliateId: aff.id, status: "APPROVED", payoutId: null },
    select: { id: true },
  });
  if (commissions.length === 0) {
    return { ok: false, error: "No approved commissions are available for payout." };
  }

  // Check there isn't already an open payout request.
  const open = await prisma.payout.findFirst({
    where: { affiliateId: aff.id, status: { in: ["REQUESTED", "APPROVED", "PROCESSING"] } },
    select: { id: true },
  });
  if (open) return { ok: false, error: "You already have a payout request in progress." };

  await prisma.$transaction(async (tx) => {
    const payout = await tx.payout.create({
      data: {
        payoutNumber: generatePayoutNumber(),
        affiliateId: aff.id,
        amount: balances.available,
        status: "REQUESTED",
        method: aff.payoutMethod,
      },
    });
    await tx.commission.updateMany({
      where: { id: { in: commissions.map((c) => c.id) } },
      data: { payoutId: payout.id },
    });
  });

  revalidatePath("/account/affiliate");
  revalidatePath("/admin/affiliates");
  revalidatePath("/admin/affiliates/payouts");
  return { ok: true };
}
