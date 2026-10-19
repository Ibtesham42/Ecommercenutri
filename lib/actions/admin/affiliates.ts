"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { defaultCouponCode } from "@/lib/affiliate/codes";
import { matureCommissions, syncPayoutAmount } from "@/lib/affiliate/commissions";
import { appendPayoutAudit, rejectionAuditText } from "@/lib/affiliate/payout-audit";
import { verifyMarketingUpload as verifyStoredUpload } from "@/lib/affiliate/marketing-upload";
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
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";

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
  if (aff.status !== "PENDING" && aff.status !== "REJECTED") {
    return {
      ok: false,
      error: aff.status === "APPROVED" ? "This affiliate is already approved." : "Reactivate a suspended affiliate instead.",
    };
  }

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
  } else {
    // A returning partner keeps their code; make sure it works again.
    const coupon = await prisma.coupon.update({
      where: { id: couponId },
      data: { isActive: true },
      select: { code: true },
    });
    couponCode = coupon.code;
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
  if (aff.status !== "PENDING") {
    return { ok: false, error: "Only a pending application can be rejected. Suspend an active affiliate instead." };
  }

  await prisma.$transaction(async (tx) => {
    await tx.affiliate.update({
      where: { id: aff.id },
      data: { status: "REJECTED", rejectionReason: parsed.data.reason },
    });
    if (aff.couponId) {
      await tx.coupon.update({ where: { id: aff.couponId }, data: { isActive: false } });
    }
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
  const admin = await requirePermission("affiliates");
  const parsed = suspendAffiliateSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };

  const aff = await prisma.affiliate.findUnique({
    where: { id: parsed.data.affiliateId },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!aff) return { ok: false, error: "Affiliate not found." };
  if (aff.status !== "APPROVED") return { ok: false, error: "Only an active affiliate can be suspended." };

  await prisma.$transaction(async (tx) => {
    await tx.affiliate.update({
      where: { id: aff.id },
      data: { status: "SUSPENDED", suspendReason: parsed.data.reason },
    });
    if (aff.couponId) {
      await tx.coupon.update({ where: { id: aff.couponId }, data: { isActive: false } });
    }
    await auditOpenPayouts(tx, aff.id, admin.email, `Affiliate suspended (${parsed.data.reason}). Payout on hold until an admin decides.`);
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
  const admin = await requirePermission("affiliates");
  const parsed = affiliateIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "We couldn't identify that affiliate. Refresh the page and try again." };
  const aff = await prisma.affiliate.findUnique({
    where: { id: parsed.data.affiliateId },
    select: { id: true, couponId: true, status: true, userId: true },
  });
  if (!aff) return { ok: false, error: "Affiliate not found." };
  if (aff.status !== "SUSPENDED") return { ok: false, error: "Only a suspended affiliate can be reactivated." };
  await prisma.$transaction(async (tx) => {
    await tx.affiliate.update({
      where: { id: aff.id },
      data: { status: "APPROVED", suspendReason: null },
    });
    if (aff.couponId) {
      await tx.coupon.update({ where: { id: aff.couponId }, data: { isActive: true } });
    }
    // Lifting the hold changes nothing else: the same single payout still needs its
    // normal approve → mark-paid steps (it is never auto-approved or duplicated).
    await auditOpenPayouts(tx, aff.id, admin.email, "Affiliate reactivated. Hold lifted; payout still needs normal approval.");
  });
  await notifyAffiliate(aff.userId, "Affiliate account reactivated", "Good news — your affiliate account is active again.");
  revalidate(aff.id);
  return { ok: true };
}

/**
 * Permanently delete an affiliate and all of its affiliate data. Allowed only for
 * inactive affiliates (SUSPENDED / REJECTED / PENDING) so an active partner with a
 * live balance can't be wiped by accident — suspend first. Clicks, commissions and
 * payouts cascade with the row; referred orders keep their `referralCode` snapshot
 * and have `affiliateId` set to null by the DB. The dedicated coupon is deleted when
 * unused, else deactivated (historical orders keep their coupon snapshot). The User
 * account itself is NOT touched — only their affiliate participation is removed, so
 * they can re-apply later.
 */
export async function deleteAffiliate(input: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  const parsed = affiliateIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "We couldn't identify that affiliate. Refresh the page and try again." };

  const aff = await prisma.affiliate.findUnique({
    where: { id: parsed.data.affiliateId },
    select: { id: true, status: true, couponId: true, userId: true },
  });
  if (!aff) return { ok: false, error: "Affiliate not found." };
  if (aff.status === "APPROVED") {
    return { ok: false, error: "Suspend this affiliate before deleting it." };
  }

  // Don't destroy an in-progress payout (it would cascade away with the affiliate).
  const openPayout = await prisma.payout.findFirst({
    where: { affiliateId: aff.id, status: { in: ["REQUESTED", "APPROVED", "PROCESSING"] } },
    select: { id: true },
  });
  if (openPayout) {
    return { ok: false, error: "Resolve the in-progress payout before deleting this affiliate." };
  }

  await prisma.$transaction(async (tx) => {
    // Clicks, commissions and payouts cascade; orders keep their snapshot and are
    // detached (affiliateId → null) by the DB's referential action.
    await tx.affiliate.delete({ where: { id: aff.id } });
    // The affiliate's coupon isn't cascaded (the FK lives on the affiliate row).
    if (aff.couponId) {
      const used = await tx.order.count({ where: { couponId: aff.couponId } });
      if (used === 0) {
        await tx.coupon.delete({ where: { id: aff.couponId } });
      } else {
        await tx.coupon.update({ where: { id: aff.couponId }, data: { isActive: false } });
      }
    }
  });

  await notifyAffiliate(
    aff.userId,
    "Affiliate account removed",
    "Your affiliate account has been removed. You're welcome to re-apply anytime.",
  );

  revalidate(aff.id);
  return { ok: true };
}

const AFFILIATE_BULK_ACTIONS = ["suspend", "reactivate"] as const;
type AffiliateBulkAction = (typeof AFFILIATE_BULK_ACTIONS)[number];

/** Bulk suspend / reactivate affiliates. Suspend deactivates their coupon and blocks
 *  attribution; reactivate restores APPROVED + the coupon. Only flips affiliates in the
 *  opposite state (idempotent) and notifies each in-app. */
export async function bulkAffiliateAction(
  ids: string[],
  action: AffiliateBulkAction,
): Promise<AdminResult<BulkOutcome>> {
  const admin = await requirePermission("affiliates");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." };
  if (!AFFILIATE_BULK_ACTIONS.includes(action)) return { ok: false, error: "Unknown action." };

  const suspend = action === "suspend";
  const affs = await prisma.affiliate.findMany({
    // Suspend applies to active partners only (a pending application is rejected instead).
    where: { id: { in: ids }, status: suspend ? "APPROVED" : "SUSPENDED" },
    select: { id: true, userId: true, couponId: true },
  });
  if (affs.length === 0) {
    return { ok: true, data: { done: 0, skipped: ids.length, note: "No affiliates changed." } };
  }

  const couponIds = affs.map((a) => a.couponId).filter((c): c is string => !!c);
  await prisma.$transaction(async (tx) => {
    await tx.affiliate.updateMany({
      where: { id: { in: affs.map((a) => a.id) } },
      data: suspend
        ? { status: "SUSPENDED", suspendReason: "Suspended in a bulk action" }
        : { status: "APPROVED", suspendReason: null },
    });
    if (couponIds.length) {
      await tx.coupon.updateMany({ where: { id: { in: couponIds } }, data: { isActive: !suspend } });
    }
    for (const a of affs) {
      await auditOpenPayouts(
        tx,
        a.id,
        admin.email,
        suspend
          ? "Affiliate suspended (bulk action). Payout on hold until an admin decides."
          : "Affiliate reactivated (bulk action). Hold lifted; payout still needs normal approval.",
      );
    }
  });

  for (const a of affs) {
    await notifyAffiliate(
      a.userId,
      suspend ? "Affiliate account suspended" : "Affiliate account reactivated",
      suspend
        ? "Your affiliate account has been suspended. Contact support if you think this is a mistake."
        : "Good news — your affiliate account is active again.",
    );
  }

  revalidate();
  revalidatePath("/account/affiliate");
  return { ok: true, data: { done: affs.length, skipped: ids.length - affs.length } };
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
  if (!parsed.success) return { ok: false, error: "We couldn't identify that commission rule. Refresh the page and try again." };
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
  if (!parsed.success) return { ok: false, error: "We couldn't identify that commission. Refresh the page and try again." };

  const c = await prisma.commission.findUnique({
    where: { id: parsed.data.commissionId },
    include: { affiliate: { select: { userId: true, user: { select: { email: true, name: true } } } } },
  });
  if (!c) return { ok: false, error: "Commission not found." };
  if (c.status !== "PENDING") return { ok: false, error: "Only pending commissions can be approved." };

  const res = await prisma.commission.updateMany({
    where: { id: c.id, status: "PENDING" },
    data: { status: "APPROVED" },
  });
  if (res.count === 0) return { ok: false, error: "This commission changed meanwhile. Refresh and try again." };

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
  if (!parsed.success) return { ok: false, error: "Please keep the cancellation reason under 300 characters." };

  const c = await prisma.commission.findUnique({
    where: { id: parsed.data.commissionId },
    include: { affiliate: { select: { userId: true } } },
  });
  if (!c) return { ok: false, error: "Commission not found." };
  if (c.status === "PAID") return { ok: false, error: "A paid commission can't be cancelled." };
  if (c.status === "CANCELLED") return { ok: false, error: "This commission is already cancelled." };

  const cancelled = await prisma.$transaction(async (tx) => {
    const res = await tx.commission.updateMany({
      where: { id: c.id, status: { in: ["PENDING", "APPROVED"] } },
      data: { status: "CANCELLED", payoutId: null },
    });
    // Keep the open payout it was in (if any) from paying it out.
    if (res.count > 0 && c.payoutId) await syncPayoutAmount(tx, c.payoutId);
    return res.count > 0;
  });
  if (!cancelled) return { ok: false, error: "This commission changed meanwhile. Refresh and try again." };

  await notifyAffiliate(
    c.affiliate.userId,
    "Commission cancelled",
    `A commission of ${formatPrice(c.amount)} was cancelled${parsed.data.reason ? `: ${parsed.data.reason}` : "."}`,
  );

  revalidatePath("/admin/affiliates/commissions");
  revalidatePath("/admin/affiliates/payouts");
  revalidatePath("/account/affiliate");
  return { ok: true };
}

// --- Payouts ------------------------------------------------------------------

/**
 * A payout whose affiliate isn't active (suspended) is ON HOLD: nothing moves it
 * forward unless an admin explicitly overrides with a reason, which is written
 * to the payout's audit trail. Rejecting stays available without an override.
 */
function holdCheck(affiliateStatus: string, overrideReason?: string): { error?: string; note: string } {
  if (affiliateStatus === "APPROVED") return { note: "" };
  if (!overrideReason) {
    return {
      error: "This affiliate is suspended, so the payout is on hold. Reject it, or continue with a recorded reason.",
      note: "",
    };
  }
  return { note: ` while affiliate ${affiliateStatus.toLowerCase()} (override: ${overrideReason})` };
}

type PayoutTx = Pick<typeof prisma, "payout">;

/** Append one audit line to each open payout of an affiliate. */
async function auditOpenPayouts(tx: PayoutTx, affiliateId: string, actor: string, text: string): Promise<void> {
  const open = await tx.payout.findMany({
    where: { affiliateId, status: { in: ["REQUESTED", "APPROVED", "PROCESSING"] } },
    select: { id: true, notes: true },
  });
  for (const p of open) {
    await tx.payout.update({ where: { id: p.id }, data: { notes: appendPayoutAudit(p.notes, actor, text) } });
  }
}

export async function approvePayout(input: unknown): Promise<AdminResult> {
  const admin = await requirePermission("affiliates");
  const parsed = payoutIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "We couldn't identify that payout." };

  const payout = await prisma.payout.findUnique({
    where: { id: parsed.data.payoutId },
    include: { affiliate: { select: { userId: true, status: true, user: { select: { email: true, name: true } } } } },
  });
  if (!payout) return { ok: false, error: "Payout not found." };
  if (payout.status !== "REQUESTED") {
    return { ok: false, error: "Only a requested payout can be approved." };
  }
  const hold = holdCheck(payout.affiliate.status, parsed.data.overrideReason);
  if (hold.error) return { ok: false, error: hold.error };
  const notes = appendPayoutAudit(payout.notes, admin.email, `Approved${hold.note}`);

  const amount = await prisma.$transaction(async (tx) => {
    await syncPayoutAmount(tx, payout.id);
    const fresh = await tx.payout.findUniqueOrThrow({ where: { id: payout.id }, select: { amount: true } });
    if (fresh.amount <= 0) return 0;
    const res = await tx.payout.updateMany({
      where: { id: payout.id, status: "REQUESTED" },
      data: { status: "APPROVED", notes },
    });
    return res.count > 0 ? fresh.amount : null;
  });
  if (amount === 0) {
    return { ok: false, error: "Every commission in this payout was cancelled. Reject it instead." };
  }
  if (amount === null) return { ok: false, error: "This payout changed meanwhile. Refresh and try again." };
  payout.amount = amount;

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
  const admin = await requirePermission("affiliates");
  const parsed = rejectPayoutSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Please keep the rejection reason under 300 characters." };

  const payout = await prisma.payout.findUnique({
    where: { id: parsed.data.payoutId },
    include: { affiliate: { select: { userId: true, user: { select: { email: true, name: true } } } } },
  });
  if (!payout) return { ok: false, error: "Payout not found." };
  if (payout.status === "PAID") return { ok: false, error: "A paid payout can't be rejected." };
  if (payout.status === "REJECTED") return { ok: false, error: "This payout is already rejected." };

  const rejected = await prisma.$transaction(async (tx) => {
    const res = await tx.payout.updateMany({
      where: { id: payout.id, status: { in: ["REQUESTED", "APPROVED", "PROCESSING"] } },
      data: { status: "REJECTED", notes: appendPayoutAudit(payout.notes, admin.email, rejectionAuditText(parsed.data.reason)) },
    });
    if (res.count === 0) return false;
    // Release the commissions back to the available pool.
    await tx.commission.updateMany({
      where: { payoutId: payout.id, status: { not: "PAID" } },
      data: { payoutId: null },
    });
    return true;
  });
  if (!rejected) return { ok: false, error: "This payout changed meanwhile. Refresh and try again." };

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
  const admin = await requirePermission("affiliates");
  const parsed = markPayoutPaidSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid request." };
  const d = parsed.data;

  const payout = await prisma.payout.findUnique({
    where: { id: d.payoutId },
    include: { affiliate: { select: { userId: true, status: true, user: { select: { email: true, name: true } } } } },
  });
  if (!payout) return { ok: false, error: "Payout not found." };
  if (payout.status === "PAID") return { ok: false, error: "This payout is already paid." };
  const hold = holdCheck(payout.affiliate.status, d.overrideReason);
  if (hold.error) return { ok: false, error: hold.error };
  if (payout.status !== "APPROVED" && payout.status !== "PROCESSING") {
    return {
      ok: false,
      error:
        payout.status === "REJECTED"
          ? "This payout was rejected and its commissions went back to the affiliate's balance."
          : "Approve this payout before marking it paid.",
    };
  }

  // Record what was actually transferred: the total is re-derived from the payout's
  // still-valid commissions, and only those flip to PAID, atomically with the
  // payout and only once (a double-click matches 0 rows the second time).
  const paidAmount = await prisma.$transaction(async (tx) => {
    await syncPayoutAmount(tx, d.payoutId);
    const fresh = await tx.payout.findUniqueOrThrow({ where: { id: d.payoutId }, select: { amount: true } });
    if (fresh.amount <= 0) return 0;
    const now = new Date();
    const res = await tx.payout.updateMany({
      where: { id: d.payoutId, status: { in: ["APPROVED", "PROCESSING"] } },
      data: {
        status: "PAID",
        method: d.method,
        reference: d.reference,
        paidAt: now,
        notes: appendPayoutAudit(payout.notes, admin.email, `Marked paid ${formatPrice(fresh.amount)} via ${d.method}, ref ${d.reference}${hold.note}`),
      },
    });
    if (res.count === 0) return null;
    await tx.commission.updateMany({
      where: { payoutId: d.payoutId, status: "APPROVED" },
      data: { status: "PAID", paidAt: now },
    });
    return fresh.amount;
  });
  if (paidAmount === 0) {
    return { ok: false, error: "Every commission in this payout was cancelled. Reject it instead." };
  }
  if (paidAmount === null) return { ok: false, error: "This payout changed meanwhile. Refresh and try again." };
  payout.amount = paidAmount;

  await notifyAffiliate(payout.affiliate.userId, "Payout processed 🏦", `Your payout of ${formatPrice(payout.amount)} has been sent (reference ${d.reference}).`);
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

/** Marketing-kit upload, step 3 (step 2 is the browser's direct upload): check the
 *  file Cloudinary actually stored; an oversized / disallowed one is deleted. */
export async function verifyMarketingUpload(url: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  if (typeof url !== "string" || !url) return { ok: false, error: "Upload failed." };
  const problem = await verifyStoredUpload(url);
  return problem ? { ok: false, error: problem } : { ok: true };
}

export async function saveMarketingAsset(input: unknown): Promise<AdminResult> {
  await requirePermission("affiliates");
  const parsed = marketingAssetSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid asset." };
  const d = parsed.data;
  // Never trust that step 3 ran: re-verify our own uploads on save.
  const problem = await verifyStoredUpload(d.fileUrl);
  if (problem) return { ok: false, error: problem };
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
  if (typeof id !== "string" || !id) return { ok: false, error: "We couldn't identify that asset." };
  const res = await prisma.marketingAsset.deleteMany({ where: { id } });
  if (res.count === 0) return { ok: false, error: "That asset was already removed." };
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
