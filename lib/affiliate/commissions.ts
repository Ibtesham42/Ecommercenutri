import { Prisma, type AffiliateRole, type CommissionType, type CommissionScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { notify } from "@/lib/notifications";
import { sendEmail } from "@/lib/email";
import { commissionEmail, couponUsedEmail } from "@/lib/emails";
import { formatPrice } from "@/lib/format";
import { getAffiliateSettings, getReturnSettings, type AffiliateSettings } from "@/lib/queries/settings";

const DAY_MS = 86_400_000;

type Rate = { type: CommissionType; value: number };

type RuleRow = {
  scope: CommissionScope;
  role: AffiliateRole | null;
  productId: string | null;
  categoryId: string | null;
  type: CommissionType;
  value: number;
};

type AffiliateForRate = {
  role: AffiliateRole;
  commissionType: CommissionType | null;
  commissionValue: number | null;
};

/** Resolve the commission rate for one order line — most-specific rule wins:
 *  PRODUCT → CATEGORY → affiliate override → ROLE default → store default. */
function resolveLineRate(
  affiliate: AffiliateForRate,
  productId: string | null,
  categoryId: string | null,
  rules: RuleRow[],
  settings: AffiliateSettings,
): Rate {
  if (productId) {
    const r = rules.find((x) => x.scope === "PRODUCT" && x.productId === productId);
    if (r) return { type: r.type, value: r.value };
  }
  if (categoryId) {
    const r = rules.find((x) => x.scope === "CATEGORY" && x.categoryId === categoryId);
    if (r) return { type: r.type, value: r.value };
  }
  if (affiliate.commissionType && affiliate.commissionValue != null) {
    return { type: affiliate.commissionType, value: affiliate.commissionValue };
  }
  const roleRule = rules.find((x) => x.scope === "ROLE" && x.role === affiliate.role);
  if (roleRule) return { type: roleRule.type, value: roleRule.value };
  return { type: settings.affiliateDefaultCommissionType, value: settings.affiliateDefaultCommissionValue };
}

type OrderForCommission = {
  subtotal: number;
  discount: number;
  items: { id: string; productId: string | null; price: number; quantity: number; discount: number }[];
};

/** Compute the total commission for an order (Σ per-line rate × line value after
 *  discount). PERCENT = % of the line's post-discount value; FIXED = value per unit,
 *  never more than the line itself. Excludes shipping and COD fees; item prices are
 *  GST-inclusive, so no tax is added on top. A line-allocated discount (Spin & Win)
 *  stays on its line; an order-level coupon is spread pro rata. */
async function computeForOrder(
  order: OrderForCommission,
  affiliate: AffiliateForRate,
): Promise<{ amount: number; base: number; meta: Prisma.InputJsonValue }> {
  const productIds = order.items.map((i) => i.productId).filter((x): x is string => !!x);
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        select: { id: true, categoryId: true },
      })
    : [];
  const catMap = new Map(products.map((p) => [p.id, p.categoryId]));
  const rules = await prisma.commissionRule.findMany({
    where: { isActive: true },
    select: { scope: true, role: true, productId: true, categoryId: true, type: true, value: true },
  });
  const settings = await getAffiliateSettings();

  const lineAllocated = order.items.some((i) => i.discount > 0);
  let amount = 0;
  let base = 0;
  const meta: CommissionLineMeta[] = [];
  for (const line of order.items) {
    const lineSubtotal = line.price * line.quantity;
    const lineAfterDiscount = Math.max(
      0,
      lineAllocated
        ? lineSubtotal - line.discount
        : order.subtotal > 0
          ? lineSubtotal - Math.round(order.discount * (lineSubtotal / order.subtotal))
          : lineSubtotal,
    );
    const categoryId = line.productId ? (catMap.get(line.productId) ?? null) : null;
    const rate = resolveLineRate(affiliate, line.productId, categoryId, rules, settings);
    const lineCommission =
      rate.type === "PERCENT"
        ? Math.round((lineAfterDiscount * Math.min(rate.value, 100)) / 100)
        : Math.min(rate.value * line.quantity, lineAfterDiscount);
    amount += lineCommission;
    base += lineAfterDiscount;
    meta.push({
      orderItemId: line.id,
      productId: line.productId,
      qty: line.quantity,
      lineAfterDiscount,
      rateType: rate.type,
      rateValue: rate.value,
      lineCommission,
    });
  }
  return { amount, base, meta: meta as unknown as Prisma.InputJsonValue };
}

/** One line of `Commission.meta` — the per-line math frozen at creation. Older rows
 *  have no `orderItemId`; they're matched by product. */
type CommissionLineMeta = {
  orderItemId?: string;
  productId: string | null;
  qty: number;
  lineAfterDiscount: number;
  rateType: CommissionType;
  rateValue: number;
  lineCommission: number;
};

function readMeta(meta: Prisma.JsonValue | null): CommissionLineMeta[] | null {
  if (!Array.isArray(meta)) return null;
  const lines = meta as unknown as CommissionLineMeta[];
  return lines.every((l) => l && typeof l.qty === "number" && l.qty > 0 && typeof l.lineCommission === "number")
    ? lines
    : null;
}

type Tx = Pick<typeof prisma, "commission" | "payout">;

/** Open payouts can still change; PAID / REJECTED ones are history. */
const OPEN_PAYOUT = ["REQUESTED", "APPROVED", "PROCESSING"] as const;

/**
 * Re-derive an open payout's amount from the APPROVED commissions still attached to
 * it, so a commission cancelled or reduced after the request is never paid out.
 * No-op for closed payouts.
 */
export async function syncPayoutAmount(tx: Tx, payoutId: string): Promise<void> {
  const agg = await tx.commission.aggregate({
    where: { payoutId, status: "APPROVED" },
    _sum: { amount: true },
  });
  await tx.payout.updateMany({
    where: { id: payoutId, status: { in: [...OPEN_PAYOUT] } },
    data: { amount: agg._sum.amount ?? 0 },
  });
}

/**
 * Create the PENDING commission for an attributed order. Idempotent (one per order
 * via `orderId @unique`). Skips self-referrals and unattributed orders. Notifies the
 * affiliate ("Commission earned" + "Coupon used"). Best-effort — never throws.
 */
export async function createOrderCommission(orderId: string): Promise<void> {
  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        affiliateId: true,
        userId: true,
        couponCode: true,
        subtotal: true,
        discount: true,
        items: { select: { id: true, productId: true, price: true, quantity: true, discount: true } },
      },
    });
    if (!order?.affiliateId) return;

    const existing = await prisma.commission.findUnique({
      where: { orderId },
      select: { id: true },
    });
    if (existing) return;

    const affiliate = await prisma.affiliate.findUnique({
      where: { id: order.affiliateId },
      select: { id: true, userId: true, status: true, role: true, commissionType: true, commissionValue: true },
    });
    if (!affiliate || affiliate.userId === order.userId) return; // gone or self-referral
    // Attribution is stamped at checkout; an affiliate suspended before the payment
    // confirmed doesn't earn on it.
    if (affiliate.status !== "APPROVED") return;

    const { amount, base, meta } = await computeForOrder(order, affiliate);
    if (amount <= 0) return;

    await prisma.commission.create({
      data: {
        affiliateId: affiliate.id,
        orderId: order.id,
        userId: order.userId,
        base,
        amount,
        status: "PENDING",
        meta,
      },
    });

    await notify(affiliate.userId, {
      type: "AFFILIATE_UPDATE",
      title: "Commission earned",
      body: `You earned ${formatPrice(amount)} on a new referred order. It'll be payable after delivery.`,
      link: "/account/affiliate",
    });
    if (order.couponCode) {
      await notify(affiliate.userId, {
        type: "AFFILIATE_UPDATE",
        title: "Your coupon was used",
        body: `${order.couponCode} was applied on a new order.`,
        link: "/account/affiliate",
      });
    }

    const u = await prisma.user.findUnique({
      where: { id: affiliate.userId },
      select: { email: true, name: true },
    });
    if (u?.email) {
      try {
        await sendEmail({ to: u.email, ...commissionEmail({ name: u.name, amount, kind: "earned" }) });
        if (order.couponCode) {
          await sendEmail({ to: u.email, ...couponUsedEmail({ name: u.name, code: order.couponCode }) });
        }
      } catch (e) {
        console.error("[affiliate] commission email failed:", e);
      }
    }
  } catch (err) {
    console.error("[affiliate] createOrderCommission failed:", err);
  }
}

/** Set a commission's maturity (delivered + return window). Called at DELIVERED. */
export async function setCommissionMature(orderId: string, deliveredAt: Date): Promise<void> {
  try {
    const { returnWindowDays } = await getReturnSettings();
    const matureAt = new Date(deliveredAt.getTime() + returnWindowDays * DAY_MS);
    await prisma.commission.updateMany({
      where: { orderId, status: "PENDING" },
      data: { matureAt },
    });
  } catch (err) {
    console.error("[affiliate] setCommissionMature failed:", err);
  }
}

/** Void an order's commission when it's cancelled/refunded (unless already PAID),
 *  releasing it from any open payout so that payout's total stays honest. */
export async function voidCommission(orderId: string): Promise<void> {
  try {
    const c = await prisma.commission.findUnique({
      where: { orderId },
      select: { id: true, payoutId: true },
    });
    if (!c) return;
    await prisma.$transaction(async (tx) => {
      const res = await tx.commission.updateMany({
        where: { id: c.id, status: { in: ["PENDING", "APPROVED"] } },
        data: { status: "CANCELLED", payoutId: null },
      });
      if (res.count > 0 && c.payoutId) await syncPayoutAmount(tx, c.payoutId);
    });
  } catch (err) {
    console.error("[affiliate] voidCommission failed:", err);
  }
}

/**
 * Bring an order's commission in line with its refunded returns: each refunded unit
 * comes off at its line's frozen per-unit commission. Recomputed from the
 * creation-time `meta` on every call, so it's idempotent across several partial
 * refunds; a fully refunded order voids the commission. PAID commissions are left
 * alone — clawing back money already paid out is a manual business decision.
 */
export async function syncCommissionWithRefunds(orderId: string): Promise<void> {
  try {
    const c = await prisma.commission.findUnique({
      where: { orderId },
      select: {
        id: true,
        amount: true,
        base: true,
        status: true,
        payoutId: true,
        meta: true,
        affiliate: { select: { userId: true } },
      },
    });
    if (!c || c.status === "CANCELLED") return;
    if (c.status === "PAID") {
      // Policy: never auto-deduct or go negative. The admin Commissions page lists
      // these under "Refunded after payout" (REFUNDED_AFTER_PAYOUT) for review.
      console.warn(`[affiliate] order ${orderId} refunded after commission ${c.id} was paid; flagged for manual review`);
      return;
    }

    const order = await prisma.order.findUnique({
      where: { id: orderId },
      select: {
        status: true,
        items: { select: { id: true, productId: true } },
        returns: {
          where: { refundStatus: "COMPLETED" },
          select: { items: { select: { orderItemId: true, quantity: true } } },
        },
      },
    });
    if (!order) return;
    if (order.status === "RETURNED" || order.status === "CANCELLED" || order.status === "REFUNDED") {
      await voidCommission(orderId);
      return;
    }
    const lines = readMeta(c.meta);
    if (!lines) {
      console.warn(`[affiliate] commission ${c.id} has no line breakdown; refund adjustment skipped`);
      return;
    }

    // Refunded units per order line, and per product for rows without orderItemId.
    const productOf = new Map(order.items.map((i) => [i.id, i.productId ?? ""]));
    const byItem = new Map<string, number>();
    const byProduct = new Map<string, number>();
    for (const r of order.returns) {
      for (const it of r.items) {
        byItem.set(it.orderItemId, (byItem.get(it.orderItemId) ?? 0) + it.quantity);
        const pid = productOf.get(it.orderItemId) ?? "";
        byProduct.set(pid, (byProduct.get(pid) ?? 0) + it.quantity);
      }
    }

    let amount = 0;
    let base = 0;
    for (const l of lines) {
      let refunded: number;
      if (l.orderItemId) {
        refunded = byItem.get(l.orderItemId) ?? 0;
      } else {
        const pid = l.productId ?? "";
        refunded = Math.min(byProduct.get(pid) ?? 0, l.qty);
        byProduct.set(pid, (byProduct.get(pid) ?? 0) - refunded);
      }
      const kept = Math.max(0, l.qty - refunded);
      amount += Math.round((l.lineCommission * kept) / l.qty);
      base += Math.round((l.lineAfterDiscount * kept) / l.qty);
    }

    if (amount <= 0) {
      await voidCommission(orderId);
      return;
    }
    if (amount === c.amount && base === c.base) return;

    await prisma.$transaction(async (tx) => {
      await tx.commission.updateMany({
        where: { id: c.id, status: { in: ["PENDING", "APPROVED"] } },
        data: { amount, base },
      });
      if (c.payoutId) await syncPayoutAmount(tx, c.payoutId);
    });
    await notify(c.affiliate.userId, {
      type: "AFFILIATE_UPDATE",
      title: "Commission adjusted",
      body: `Part of a referred order was returned, so that commission is now ${formatPrice(amount)} (was ${formatPrice(c.amount)}).`,
      link: "/account/affiliate",
    });
  } catch (err) {
    console.error("[affiliate] syncCommissionWithRefunds failed:", err);
  }
}

/**
 * Flip matured PENDING commissions → APPROVED (payable). Idempotent; safe to call on
 * read (dashboard / admin) and from a manual sweep. Returns the count matured. This
 * is the single function a future Vercel Cron would call. An order with a return
 * still in progress is held until the return is resolved.
 */
export async function matureCommissions(): Promise<number> {
  const now = new Date();
  const due = await prisma.commission.findMany({
    where: {
      status: "PENDING",
      matureAt: { not: null, lte: now },
      order: {
        status: "DELIVERED",
        returns: { none: { status: { notIn: ["REFUNDED", "REJECTED", "CANCELLED"] } } },
      },
    },
    select: { id: true, amount: true, affiliate: { select: { userId: true } } },
  });

  let matured = 0;
  for (const c of due) {
    // Re-check the status at write time so a concurrent cancel is never undone.
    const res = await prisma.commission.updateMany({
      where: { id: c.id, status: "PENDING" },
      data: { status: "APPROVED" },
    });
    if (res.count === 0) continue;
    matured += 1;
    await notify(c.affiliate.userId, {
      type: "AFFILIATE_UPDATE",
      title: "Commission approved",
      body: `${formatPrice(c.amount)} is now approved and available for payout.`,
      link: "/account/affiliate",
    });
  }
  return matured;
}

export type AffiliateBalances = {
  pending: number;
  approved: number;
  paid: number;
  available: number; // approved, not yet assigned to a payout
};

export async function affiliateBalances(affiliateId: string): Promise<AffiliateBalances> {
  const [grouped, avail] = await Promise.all([
    prisma.commission.groupBy({
      by: ["status"],
      where: { affiliateId },
      _sum: { amount: true },
    }),
    prisma.commission.aggregate({
      where: { affiliateId, status: "APPROVED", payoutId: null },
      _sum: { amount: true },
    }),
  ]);
  const sumFor = (s: string) => grouped.find((g) => g.status === s)?._sum.amount ?? 0;
  return {
    pending: sumFor("PENDING"),
    approved: sumFor("APPROVED"),
    paid: sumFor("PAID"),
    available: avail._sum.amount ?? 0,
  };
}
