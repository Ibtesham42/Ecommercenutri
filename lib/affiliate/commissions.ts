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
  items: { productId: string | null; price: number; quantity: number }[];
};

/** Compute the total commission for an order (Σ per-line rate × line subtotal after
 *  pro-rata discount). PERCENT = % of the line's post-discount value; FIXED = value
 *  per unit. Excludes tax (GST is inclusive) and shipping. */
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

  let amount = 0;
  let base = 0;
  const meta: Record<string, unknown>[] = [];
  for (const line of order.items) {
    const lineSubtotal = line.price * line.quantity;
    const lineAfterDiscount =
      order.subtotal > 0
        ? lineSubtotal - Math.round(order.discount * (lineSubtotal / order.subtotal))
        : lineSubtotal;
    const categoryId = line.productId ? (catMap.get(line.productId) ?? null) : null;
    const rate = resolveLineRate(affiliate, line.productId, categoryId, rules, settings);
    const lineCommission =
      rate.type === "PERCENT"
        ? Math.round((lineAfterDiscount * rate.value) / 100)
        : rate.value * line.quantity;
    amount += lineCommission;
    base += lineAfterDiscount;
    meta.push({
      productId: line.productId,
      qty: line.quantity,
      lineAfterDiscount,
      rateType: rate.type,
      rateValue: rate.value,
      lineCommission,
    });
  }
  return { amount, base, meta: meta as Prisma.InputJsonValue };
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
        items: { select: { productId: true, price: true, quantity: true } },
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
      select: { id: true, userId: true, role: true, commissionType: true, commissionValue: true },
    });
    if (!affiliate || affiliate.userId === order.userId) return; // gone or self-referral

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

/** Void an order's commission when it's cancelled/refunded (unless already PAID). */
export async function voidCommission(orderId: string): Promise<void> {
  try {
    await prisma.commission.updateMany({
      where: { orderId, status: { in: ["PENDING", "APPROVED"] } },
      data: { status: "CANCELLED" },
    });
  } catch (err) {
    console.error("[affiliate] voidCommission failed:", err);
  }
}

/**
 * Flip matured PENDING commissions → APPROVED (payable). Idempotent; safe to call on
 * read (dashboard / admin) and from a manual sweep. Returns the count matured. This
 * is the single function a future Vercel Cron would call.
 */
export async function matureCommissions(): Promise<number> {
  const now = new Date();
  const due = await prisma.commission.findMany({
    where: {
      status: "PENDING",
      matureAt: { not: null, lte: now },
      order: { status: "DELIVERED" },
    },
    select: { id: true, amount: true, affiliate: { select: { userId: true } } },
  });
  if (due.length === 0) return 0;

  await prisma.commission.updateMany({
    where: { id: { in: due.map((d) => d.id) } },
    data: { status: "APPROVED" },
  });

  for (const c of due) {
    await notify(c.affiliate.userId, {
      type: "AFFILIATE_UPDATE",
      title: "Commission approved",
      body: `${formatPrice(c.amount)} is now approved and available for payout.`,
      link: "/account/affiliate",
    });
  }
  return due.length;
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
