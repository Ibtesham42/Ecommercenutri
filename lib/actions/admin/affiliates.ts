"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { defaultCouponCode } from "@/lib/affiliate/codes";
import { matureCommissions } from "@/lib/affiliate/commissions";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { affiliateStatusEmail, payoutEmail, payoutUpdateEmail, commissionEmail } from "@/lib/emails";
import { formatPrice } from "@/lib/format";
import {
  approveAffiliateSchema,
  rejectAffiliateSchema,
  suspendAffiliateSchema,
  affiliateIdSchema,
  setCommissionSchema,
  commissionRuleSchema,
  ruleIdSchema,
  commissionIdSchema,
  cancelCommissionSchema,
  payoutIdSchema,
  markPayoutPaidSchema,
  rejectPayoutSchema,
  affiliateSettingsSchema,
  marketingAssetSchema,
} from "@/lib/validations/affiliate";
import type { AdminResult } from "@/lib/actions/admin/types";

function revalidate(affiliateId?: string) {
  revalidatePath("/admin/affiliates");
  if (affiliateId) revalidatePath(`/admin/affiliates/${affiliateId}`);
  revalidatePath("/account/affiliate");
}

async function notifyAffiliate(
  userId: string,
  title: string,
  body: string,
): Promise<void> {
  await notify(userId, { type: "AFFILIATE_UPDATE", title, body, link: "/account/affiliate" });
}

// --- Approval / status --------------------------------------------------------

export async function approveAffiliate(input: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  const parsed = approveAffiliateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const d = parsed.data;

  const aff = await prisma.affiliate.findUnique({
    where: { id: d.affiliateId },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!aff) return { ok: false, error: "Affiliate not found." };

  // Create the affiliate's coupon if it doesn't have one yet.
  let couponId = aff.couponId;
  let couponCode: string | null = null;
  if (!couponId) {
    const percent = d.couponPercent ?? 10;
    let code =
      (d.couponCode || defaultCouponCode(aff.displayName, percent))
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "") || `NUTRI${percent}`;
    const clash = await prisma.coupon.findUnique({ where: { code }, select: { id: true } });
    if (clash) code = `${code}${aff.code.toUpperCase().slice(0, 4)}`;
    const coupon = await prisma.coupon.create({
      data: {
        code,
        type: "PERCENT",
        value: percent,
        description: `Affiliate ${aff.code}`,
        isActive: true,
      },
    });
    couponId = coupon.id;
    couponCode = code;
  }

  await prisma.affiliate.update({
    where: { id: aff.id },
    data: {
      status: "APPROVED",
      approvedAt: new Date(),
      rejectionReason: null,
      suspendReason: null,
      couponId,
      ...(d.commissionType ? { commissionType: d.commissionType } : {}),
      ...(d.commissionValue != null ? { commissionValue: d.commissionValue } : {}),
    },
  });

  await notifyAffiliate(aff.userId, "You're approved! 🎉", "Your affiliate account is active. Open your dashboard to get your link, QR and coupon.");
  if (aff.user.email) {
    const mail = affiliateStatusEmail({ status: "APPROVED", name: aff.user.name, code: aff.code, couponCode });
    if (mail) {
      try {
        await sendEmail({ to: aff.user.email, ...mail });
      } catch (e) {
        console.error("[admin/affiliates] approve email failed:", e);
      }
    }
  }

  revalidate(aff.id);
  return { ok: true };
}

export async function rejectAffiliate(input: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  const parsed = rejectAffiliateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const aff = await prisma.affiliate.findUnique({
    where: { id: parsed.data.affiliateId },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!aff) return { ok: false, error: "Affiliate not found." };

  await prisma.affiliate.update({
    where: { id: aff.id },
    data: { status: "REJECTED", rejectionReason: parsed.data.reason },
  });
  await notifyAffiliate(aff.userId, "Affiliate application declined", parsed.data.reason);
  if (aff.user.email) {
    const mail = affiliateStatusEmail({ status: "REJECTED", name: aff.user.name, reason: parsed.data.reason });
    if (mail) {
      try {
        await sendEmail({ to: aff.user.email, ...mail });
      } catch {
        /* ignore */
      }
    }
  }
  revalidate(aff.id);
  return { ok: true };
}

export async function suspendAffiliate(input: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  const parsed = suspendAffiliateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const aff = await prisma.affiliate.findUnique({
    where: { id: parsed.data.affiliateId },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!aff) return { ok: false, error: "Affiliate not found." };

  await prisma.$transaction(async (tx) => {
    await tx.affiliate.update({
      where: { id: aff.id },
      data: { status: "SUSPENDED", suspendReason: parsed.data.reason },
    });
    if (aff.couponId) {
      await tx.coupon.update({ where: { id: aff.couponId }, data: { isActive: false } });
    }
  });
  await notifyAffiliate(aff.userId, "Affiliate account suspended", parsed.data.reason);
  if (aff.user.email) {
    const mail = affiliateStatusEmail({ status: "SUSPENDED", name: aff.user.name, reason: parsed.data.reason });
    if (mail) {
      try {
        await sendEmail({ to: aff.user.email, ...mail });
      } catch {
        /* ignore */
      }
    }
  }
  revalidate(aff.id);
  return { ok: true };
}

export async function reactivateAffiliate(input: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  const parsed = affiliateIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  const aff = await prisma.affiliate.findUnique({
    where: { id: parsed.data.affiliateId },
    select: { id: true, couponId: true },
  });
  if (!aff) return { ok: false, error: "Affiliate not found." };
  await prisma.$transaction(async (tx) => {
    await tx.affiliate.update({
      where: { id: aff.id },
      data: { status: "APPROVED", suspendReason: null },
    });
    if (aff.couponId) {
      await tx.coupon.update({ where: { id: aff.couponId }, data: { isActive: true } });
    }
  });
  revalidate(aff.id);
  return { ok: true };
}

export async function setAffiliateCommission(input: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  const parsed = setCommissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const d = parsed.data;
  await prisma.affiliate.update({
    where: { id: d.affiliateId },
    data: {
      commissionType: d.commissionType ?? null,
      commissionValue: d.commissionValue ?? null,
    },
  });
  revalidate(d.affiliateId);
  return { ok: true };
}

// --- Commission rules ---------------------------------------------------------

export async function saveCommissionRule(input: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  const parsed = commissionRuleSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid rule." };
  const d = parsed.data;

  const data = {
    scope: d.scope,
    role: d.scope === "ROLE" ? (d.role ?? null) : null,
    productId: d.scope === "PRODUCT" ? d.productId || null : null,
    categoryId: d.scope === "CATEGORY" ? d.categoryId || null : null,
    type: d.type,
    value: d.value,
    isActive: d.isActive,
  };
  if (d.scope === "ROLE" && !data.role) return { ok: false, error: "Pick a role." };
  if (d.scope === "PRODUCT" && !data.productId) return { ok: false, error: "Pick a product." };
  if (d.scope === "CATEGORY" && !data.categoryId) return { ok: false, error: "Pick a category." };

  if (d.id) {
    await prisma.commissionRule.update({ where: { id: d.id }, data });
  } else {
    await prisma.commissionRule.create({ data });
  }
  revalidatePath("/admin/affiliates/rules");
  return { ok: true };
}

export async function deleteCommissionRule(input: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  const parsed = ruleIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };
  await prisma.commissionRule.delete({ where: { id: parsed.data.id } });
  revalidatePath("/admin/affiliates/rules");
  return { ok: true };
}

// --- Commission maturation ----------------------------------------------------

export async function runMaturation(): Promise<AdminResult<{ count: number }>> {
  await requirePermission("affiliates");
  const count = await matureCommissions();
  revalidatePath("/admin/affiliates");
  revalidatePath("/admin/affiliates/commissions");
  revalidatePath("/admin/affiliates/payouts");
  return { ok: true, data: { count } };
}

/** Manually approve a PENDING commission early (before auto-maturation). Notifies. */
export async function approveCommission(input: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  const parsed = commissionIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const c = await prisma.commission.findUnique({
    where: { id: parsed.data.commissionId },
    include: { affiliate: { select: { userId: true, user: { select: { email: true, name: true } } } } },
  });
  if (!c) return { ok: false, error: "Commission not found." };
  if (c.status !== "PENDING") return { ok: false, error: "Only pending commissions can be approved." };

  await prisma.commission.update({
    where: { id: c.id },
    data: { status: "APPROVED" },
  });

  await notifyAffiliate(
    c.affiliate.userId,
    "Commission approved",
    `${formatPrice(c.amount)} is now approved and available for payout.`,
  );
  if (c.affiliate.user.email) {
    try {
      await sendEmail({
        to: c.affiliate.user.email,
        ...commissionEmail({ name: c.affiliate.user.name, amount: c.amount, kind: "approved" }),
      });
    } catch {
      /* ignore */
    }
  }

  revalidatePath("/admin/affiliates/commissions");
  revalidatePath("/account/affiliate");
  return { ok: true };
}

/** Manually cancel a PENDING/APPROVED commission (fraud / adjustment). Releases it
 *  from any open payout and notifies the affiliate. PAID commissions can't be voided. */
export async function cancelCommission(input: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  const parsed = cancelCommissionSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const c = await prisma.commission.findUnique({
    where: { id: parsed.data.commissionId },
    include: { affiliate: { select: { userId: true } } },
  });
  if (!c) return { ok: false, error: "Commission not found." };
  if (c.status === "PAID") return { ok: false, error: "A paid commission can't be cancelled." };
  if (c.status === "CANCELLED") return { ok: false, error: "This commission is already cancelled." };

  await prisma.commission.update({
    where: { id: c.id },
    data: { status: "CANCELLED", payoutId: null },
  });

  await notifyAffiliate(
    c.affiliate.userId,
    "Commission cancelled",
    `A commission of ${formatPrice(c.amount)} was cancelled${parsed.data.reason ? `: ${parsed.data.reason}` : "."}`,
  );

  revalidatePath("/admin/affiliates/commissions");
  revalidatePath("/account/affiliate");
  return { ok: true };
}

// --- Payouts ------------------------------------------------------------------

export async function approvePayout(input: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  const parsed = payoutIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const payout = await prisma.payout.findUnique({
    where: { id: parsed.data.payoutId },
    include: { affiliate: { select: { userId: true, user: { select: { email: true, name: true } } } } },
  });
  if (!payout) return { ok: false, error: "Payout not found." };
  if (payout.status !== "REQUESTED") {
    return { ok: false, error: "Only a requested payout can be approved." };
  }

  await prisma.payout.update({
    where: { id: payout.id },
    data: { status: "APPROVED" },
  });

  await notifyAffiliate(
    payout.affiliate.userId,
    "Payout approved ✅",
    `Your payout of ${formatPrice(payout.amount)} was approved and is being processed.`,
  );
  if (payout.affiliate.user.email) {
    try {
      await sendEmail({
        to: payout.affiliate.user.email,
        ...payoutUpdateEmail({ status: "APPROVED", name: payout.affiliate.user.name, amount: payout.amount }),
      });
    } catch {
      /* ignore */
    }
  }

  revalidatePath("/admin/affiliates/payouts");
  revalidatePath("/account/affiliate");
  return { ok: true };
}

export async function rejectPayout(input: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  const parsed = rejectPayoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid request." };

  const payout = await prisma.payout.findUnique({
    where: { id: parsed.data.payoutId },
    include: { affiliate: { select: { userId: true, user: { select: { email: true, name: true } } } } },
  });
  if (!payout) return { ok: false, error: "Payout not found." };
  if (payout.status === "PAID") return { ok: false, error: "A paid payout can't be rejected." };

  await prisma.$transaction(async (tx) => {
    await tx.payout.update({
      where: { id: payout.id },
      data: { status: "REJECTED", notes: parsed.data.reason || null },
    });
    // Release the commissions back to the available pool.
    await tx.commission.updateMany({
      where: { payoutId: payout.id },
      data: { payoutId: null },
    });
  });

  await notifyAffiliate(
    payout.affiliate.userId,
    "Payout request declined",
    `Your payout of ${formatPrice(payout.amount)} wasn't approved${
      parsed.data.reason ? `: ${parsed.data.reason}` : "."
    } The amount is back in your available balance.`,
  );
  if (payout.affiliate.user.email) {
    try {
      await sendEmail({
        to: payout.affiliate.user.email,
        ...payoutUpdateEmail({
          status: "REJECTED",
          name: payout.affiliate.user.name,
          amount: payout.amount,
          reason: parsed.data.reason,
        }),
      });
    } catch {
      /* ignore */
    }
  }

  revalidatePath("/admin/affiliates/payouts");
  revalidatePath("/account/affiliate");
  return { ok: true };
}

export async function markPayoutPaid(input: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  const parsed = markPayoutPaidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const d = parsed.data;

  const payout = await prisma.payout.findUnique({
    where: { id: d.payoutId },
    include: { affiliate: { select: { userId: true, user: { select: { email: true, name: true } } } } },
  });
  if (!payout) return { ok: false, error: "Payout not found." };
  if (payout.status === "PAID") return { ok: false, error: "This payout is already paid." };

  await prisma.$transaction(async (tx) => {
    await tx.payout.update({
      where: { id: d.payoutId },
      data: { status: "PAID", method: d.method, reference: d.reference || null, paidAt: new Date() },
    });
    await tx.commission.updateMany({
      where: { payoutId: d.payoutId },
      data: { status: "PAID", paidAt: new Date() },
    });
  });

  await notifyAffiliate(payout.affiliate.userId, "Payout processed 🏦", `Your payout of ₹${(payout.amount / 100).toFixed(2)} has been processed.`);
  if (payout.affiliate.user.email) {
    try {
      await sendEmail({
        to: payout.affiliate.user.email,
        ...payoutEmail({
          name: payout.affiliate.user.name,
          amount: payout.amount,
          method: d.method,
          reference: d.reference,
        }),
      });
    } catch {
      /* ignore */
    }
  }

  revalidatePath("/admin/affiliates/payouts");
  revalidatePath("/account/affiliate");
  return { ok: true };
}

// --- Marketing kit ------------------------------------------------------------

export async function saveMarketingAsset(input: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  const parsed = marketingAssetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid asset." };
  const d = parsed.data;
  const data = {
    title: d.title,
    description: d.description || null,
    type: d.type,
    fileUrl: d.fileUrl,
    thumbnailUrl: d.thumbnailUrl || null,
    isActive: d.isActive,
  };
  if (d.id) {
    await prisma.marketingAsset.update({ where: { id: d.id }, data });
  } else {
    await prisma.marketingAsset.create({ data });
  }
  revalidatePath("/admin/affiliates/marketing-kit");
  revalidatePath("/account/affiliate");
  return { ok: true };
}

export async function deleteMarketingAsset(id: string): Promise<AdminResult> {
  await requirePermission("affiliates");
  await prisma.marketingAsset.delete({ where: { id } });
  revalidatePath("/admin/affiliates/marketing-kit");
  revalidatePath("/account/affiliate");
  return { ok: true };
}

// --- Settings -----------------------------------------------------------------

export async function updateAffiliateSettings(input: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  const parsed = affiliateSettingsSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  const d = parsed.data;
  await prisma.storeSetting.upsert({
    where: { id: "singleton" },
    update: d,
    create: { id: "singleton", ...d },
  });
  revalidatePath("/admin/affiliates/settings");
  revalidatePath("/account/affiliate");
  return { ok: true };
}
