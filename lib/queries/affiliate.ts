import { subMonths, startOfMonth, format } from "date-fns";
import {
  Prisma,
  type AffiliateStatus,
  type AffiliateRole,
  type PayoutStatus,
  type CommissionStatus,
} from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { affiliateBalances } from "@/lib/affiliate/commissions";
import { getAffiliateSettings, getReturnSettings } from "@/lib/queries/settings";
import { formatPrice } from "@/lib/format";

/** The current user's affiliate record (+ its coupon), or null. */
export async function getMyAffiliate(userId: string) {
  return prisma.affiliate.findUnique({
    where: { userId },
    include: { coupon: { select: { code: true, type: true, value: true, usedCount: true } } },
  });
}

/**
 * A referred order "counts" once it's confirmed (paid, or COD placed) — that's
 * exactly when its Commission row is created — and stops counting if it's
 * cancelled or fully refunded (commission CANCELLED). Orders merely stamped with
 * an affiliate at checkout (abandoned / failed payments) never count, so all
 * order / sales / conversion figures are derived from commissions, not orders.
 */
const COUNTED = { status: { not: "CANCELLED" } } as const satisfies Prisma.CommissionWhereInput;

export type MonthlyPoint = { month: string; clicks: number; orders: number; commission: number };

async function monthlySeries(affiliateId: string): Promise<MonthlyPoint[]> {
  const since = startOfMonth(subMonths(new Date(), 5));
  const [clicks, orders] = await Promise.all([
    prisma.affiliateClick.findMany({
      where: { affiliateId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.commission.findMany({
      where: { affiliateId, ...COUNTED, createdAt: { gte: since } },
      select: { createdAt: true, amount: true },
    }),
  ]);

  const buckets = new Map<string, MonthlyPoint>();
  for (let i = 5; i >= 0; i--) {
    const d = startOfMonth(subMonths(new Date(), i));
    buckets.set(format(d, "yyyy-MM"), { month: format(d, "MMM"), clicks: 0, orders: 0, commission: 0 });
  }
  for (const c of clicks) {
    const k = format(c.createdAt, "yyyy-MM");
    const b = buckets.get(k);
    if (b) b.clicks += 1;
  }
  for (const o of orders) {
    const k = format(o.createdAt, "yyyy-MM");
    const b = buckets.get(k);
    if (b) {
      b.orders += 1;
      b.commission += o.amount;
    }
  }
  return [...buckets.values()];
}

/** Full affiliate dashboard payload (stats + recent orders + payouts + coupon). */
export async function getAffiliateDashboard(affiliate: {
  id: string;
  couponId: string | null;
}) {
  const [clicks, clickIds, counted, balances, recent, payouts, coupon, monthly, customers] =
    await Promise.all([
      prisma.affiliateClick.count({ where: { affiliateId: affiliate.id } }),
      prisma.affiliateClick.findMany({
        where: { affiliateId: affiliate.id },
        select: { anonId: true, userId: true },
        take: 5000,
      }),
      prisma.commission.aggregate({
        where: { affiliateId: affiliate.id, ...COUNTED },
        _count: true,
        _sum: { base: true },
      }),
      affiliateBalances(affiliate.id),
      prisma.commission.findMany({
        where: { affiliateId: affiliate.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          amount: true,
          base: true,
          status: true,
          matureAt: true,
          createdAt: true,
          order: { select: { orderNumber: true, status: true } },
        },
      }),
      prisma.payout.findMany({
        where: { affiliateId: affiliate.id },
        orderBy: { createdAt: "desc" },
        take: 10,
      }),
      affiliate.couponId
        ? prisma.coupon.findUnique({
            where: { id: affiliate.couponId },
            select: { code: true, type: true, value: true, usedCount: true },
          })
        : Promise.resolve(null),
      monthlySeries(affiliate.id),
      prisma.commission.groupBy({ by: ["userId"], where: { affiliateId: affiliate.id, ...COUNTED } }),
    ]);

  const uniqueVisitors = new Set(clickIds.map((c) => c.userId ?? c.anonId ?? "?")).size;
  const ordersCount = counted._count;
  const conversion = uniqueVisitors > 0 ? Math.min(1, ordersCount / uniqueVisitors) : 0;
  // Only order number + statuses leave the server: never the buyer's identity.
  const recentOrders = recent.map((c) => ({
    orderNumber: c.order.orderNumber,
    orderStatus: c.order.status,
    createdAt: c.createdAt,
    sale: c.base,
    commission: { amount: c.amount, status: c.status, matureAt: c.matureAt },
  }));

  return {
    clicks,
    uniqueVisitors,
    customers: customers.length,
    orders: ordersCount,
    /** Commissionable sales (items after discount, excl. shipping) of counted orders. */
    revenue: counted._sum.base ?? 0,
    conversion,
    balances,
    recentOrders,
    payouts,
    coupon,
    monthly,
  };
}

export type EarningTerms = {
  rate: { type: "PERCENT" | "FIXED"; value: number };
  /** Some products / categories carry their own rate. */
  hasSpecialRates: boolean;
  cookieDays: number;
  returnWindowDays: number;
  minPayout: number;
};

/**
 * The plain-language terms an affiliate (or applicant) earns under, read from the
 * live configuration: their headline rate (personal override → role rule → store
 * default, mirroring the engine minus product/category rules), the attribution
 * window, when commission becomes payable and the payout minimum.
 */
export async function getEarningTerms(
  affiliate: { role: AffiliateRole; commissionType: "PERCENT" | "FIXED" | null; commissionValue: number | null } | null,
): Promise<EarningTerms> {
  const [settings, returns, roleRule, special] = await Promise.all([
    getAffiliateSettings(),
    getReturnSettings(),
    affiliate
      ? prisma.commissionRule.findFirst({
          where: { scope: "ROLE", role: affiliate.role, isActive: true },
          select: { type: true, value: true },
        })
      : Promise.resolve(null),
    prisma.commissionRule.count({ where: { scope: { in: ["PRODUCT", "CATEGORY"] }, isActive: true } }),
  ]);
  const rate =
    affiliate?.commissionType && affiliate.commissionValue != null
      ? { type: affiliate.commissionType, value: affiliate.commissionValue }
      : roleRule
        ? { type: roleRule.type, value: roleRule.value }
        : { type: settings.affiliateDefaultCommissionType, value: settings.affiliateDefaultCommissionValue };
  return {
    rate,
    hasSpecialRates: special > 0,
    cookieDays: settings.affiliateCookieDays,
    returnWindowDays: returns.returnWindowDays,
    minPayout: settings.affiliateMinPayout,
  };
}

/** Active marketing-kit assets (shared by the affiliate dashboard + admin). */
export async function getMarketingAssets(activeOnly = true) {
  return prisma.marketingAsset.findMany({
    where: activeOnly ? { isActive: true } : {},
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
  });
}

// --- Admin --------------------------------------------------------------------

export type AdminAffiliateFilters = { status?: string; role?: string; q?: string };

export async function getAdminAffiliates(f: AdminAffiliateFilters) {
  const where: Prisma.AffiliateWhereInput = {};
  if (f.status && f.status !== "ALL") where.status = f.status as AffiliateStatus;
  if (f.role && f.role !== "ALL") where.role = f.role as AffiliateRole;
  const q = f.q?.trim();
  if (q) {
    where.OR = [
      { code: { contains: q, mode: "insensitive" } },
      { displayName: { contains: q, mode: "insensitive" } },
      { user: { email: { contains: q, mode: "insensitive" } } },
      { user: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  return prisma.affiliate.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      user: { select: { name: true, email: true } },
      _count: { select: { commissions: { where: COUNTED }, clicks: true } },
    },
  });
}

export async function getAdminAffiliate(id: string) {
  const affiliate = await prisma.affiliate.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true, phone: true } },
      coupon: { select: { code: true, type: true, value: true, usedCount: true } },
      commissions: {
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { order: { select: { orderNumber: true } } },
      },
      payouts: {
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { _count: { select: { commissions: true } } },
      },
    },
  });
  if (!affiliate) return null;
  const [balances, stats, risk] = await Promise.all([
    affiliateBalances(affiliate.id),
    Promise.all([
      prisma.affiliateClick.count({ where: { affiliateId: affiliate.id } }),
      prisma.commission.aggregate({
        where: { affiliateId: affiliate.id, ...COUNTED },
        _count: true,
        _sum: { base: true },
      }),
    ]).then(([clicks, c]) => ({ clicks, orders: c._count, revenue: c._sum.base ?? 0 })),
    getAffiliateRiskSignals(affiliate),
  ]);
  return { affiliate, balances, stats, risk };
}

export type RiskSignal = { level: "warn" | "info"; text: string };

/**
 * Heuristic review flags for the admin (never acted on automatically): payout
 * details shared with another affiliate, buyer concentration, a high cancel /
 * refund rate, and click-to-visitor anomalies. Thresholds are deliberately loose
 * and need a minimum sample so a new partner isn't flagged on noise.
 */
async function getAffiliateRiskSignals(a: {
  id: string;
  upiId: string | null;
  bankAccount: string | null;
}): Promise<RiskSignal[]> {
  const signals: RiskSignal[] = [];
  const sharedWhere: Prisma.AffiliateWhereInput[] = [];
  if (a.upiId) sharedWhere.push({ upiId: { equals: a.upiId, mode: "insensitive" } });
  if (a.bankAccount) sharedWhere.push({ bankAccount: a.bankAccount });

  const [shared, byStatus, byBuyer, clicks, visitorRows, refundedPaid] = await Promise.all([
    sharedWhere.length
      ? prisma.affiliate.findMany({
          where: { id: { not: a.id }, OR: sharedWhere },
          select: { code: true },
          take: 5,
        })
      : Promise.resolve([]),
    prisma.commission.groupBy({ by: ["status"], where: { affiliateId: a.id }, _count: true }),
    prisma.commission.groupBy({
      by: ["userId"],
      where: { affiliateId: a.id },
      _count: true,
      orderBy: { _count: { userId: "desc" } },
      take: 1,
    }),
    prisma.affiliateClick.count({ where: { affiliateId: a.id } }),
    prisma.affiliateClick.groupBy({ by: ["ipHash"], where: { affiliateId: a.id } }),
    prisma.commission.aggregate({
      where: { affiliateId: a.id, ...REFUNDED_AFTER_PAYOUT },
      _count: true,
      _sum: { amount: true },
    }),
  ]);

  if (refundedPaid._count > 0) {
    signals.push({
      level: "warn",
      text: `${refundedPaid._count} already-paid commission(s) (${formatPrice(refundedPaid._sum.amount ?? 0)}) belong to orders refunded after payout. Nothing was deducted; decide manually.`,
    });
  }

  if (shared.length) {
    signals.push({
      level: "warn",
      text: `Payout details match another affiliate (${shared.map((x) => x.code).join(", ")}) — possible duplicate account.`,
    });
  }
  const total = byStatus.reduce((n, g) => n + g._count, 0);
  const cancelled = byStatus.find((g) => g.status === "CANCELLED")?._count ?? 0;
  if (total >= 5 && cancelled / total >= 0.4) {
    signals.push({
      level: "warn",
      text: `${cancelled} of ${total} referred orders were cancelled or refunded.`,
    });
  }
  const top = byBuyer[0];
  if (top && total >= 4 && top._count / total >= 0.5) {
    signals.push({
      level: "warn",
      text: `One customer placed ${top._count} of ${total} referred orders — check for a friend or second account.`,
    });
  }
  if (clicks >= 50 && visitorRows.length > 0 && clicks / visitorRows.length >= 10) {
    signals.push({
      level: "info",
      text: `${clicks} clicks came from only ${visitorRows.length} network(s) — traffic may be automated.`,
    });
  }
  return signals;
}

export async function getCommissionRules() {
  return prisma.commissionRule.findMany({
    orderBy: [{ scope: "asc" }, { createdAt: "desc" }],
    include: {
      product: { select: { name: true } },
      category: { select: { name: true } },
    },
  });
}

export async function getAdminPayouts(status?: string) {
  const where: Prisma.PayoutWhereInput =
    status && status !== "ALL" ? { status: status as PayoutStatus } : {};
  return prisma.payout.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 300,
    include: {
      _count: { select: { commissions: true } },
      affiliate: {
        select: {
          id: true,
          code: true,
          displayName: true,
          status: true,
          payoutMethod: true,
          upiId: true,
          bankName: true,
          bankAccount: true,
          bankIfsc: true,
          accountName: true,
          user: { select: { email: true } },
        },
      },
    },
  });
}

export type AdminCommissionFilters = { status?: string; search?: string };

/**
 * A PAID commission whose order was later refunded (in part or in full) or
 * closed. Policy: nothing is deducted automatically and no negative balance is
 * created; these are surfaced for a manual admin decision.
 */
export const REFUNDED_AFTER_PAYOUT: Prisma.CommissionWhereInput = {
  status: "PAID",
  order: {
    OR: [
      { status: { in: ["CANCELLED", "RETURNED", "REFUNDED"] } },
      { returns: { some: { refundStatus: "COMPLETED" } } },
    ],
  },
};

/** All commissions for the admin commission-management page (filterable + totals). */
export async function getAdminCommissions(f: AdminCommissionFilters = {}) {
  const where: Prisma.CommissionWhereInput = {};
  if (f.status === "REVIEW") Object.assign(where, REFUNDED_AFTER_PAYOUT);
  else if (f.status && f.status !== "ALL") where.status = f.status as CommissionStatus;
  if (f.search?.trim()) {
    const q = f.search.trim();
    where.OR = [
      { order: { orderNumber: { contains: q, mode: "insensitive" } } },
      { affiliate: { code: { contains: q, mode: "insensitive" } } },
      { affiliate: { displayName: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [commissions, totals, review] = await Promise.all([
    prisma.commission.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 300,
      include: {
        order: { select: { orderNumber: true, status: true } },
        affiliate: { select: { id: true, code: true, displayName: true } },
      },
    }),
    prisma.commission.groupBy({ by: ["status"], _sum: { amount: true }, _count: true }),
    prisma.commission.findMany({ where: REFUNDED_AFTER_PAYOUT, select: { id: true, amount: true } }),
  ]);
  const reviewIds = new Set(review.map((r) => r.id));

  const sumFor = (s: string) => totals.find((t) => t.status === s)?._sum.amount ?? 0;
  const countFor = (s: string) => totals.find((t) => t.status === s)?._count ?? 0;
  return {
    commissions: commissions.map((c) => ({ ...c, refundedAfterPayout: reviewIds.has(c.id) })),
    summary: {
      review: { amount: review.reduce((n, r) => n + r.amount, 0), count: review.length },
      pending: { amount: sumFor("PENDING"), count: countFor("PENDING") },
      approved: { amount: sumFor("APPROVED"), count: countFor("APPROVED") },
      paid: { amount: sumFor("PAID"), count: countFor("PAID") },
      cancelled: { amount: sumFor("CANCELLED"), count: countFor("CANCELLED") },
    },
  };
}

/** Affiliate analytics aggregates (top affiliates, coupon performance, totals). */
export async function getAffiliateAnalytics() {
  const [affiliates, revByAff, commByAff, clicksByAff, ordersByAff, commTotal, clicksTotal] =
    await Promise.all([
      prisma.affiliate.findMany({
        where: { status: "APPROVED" },
        select: {
          id: true,
          code: true,
          displayName: true,
          role: true,
          coupon: { select: { code: true, usedCount: true } },
        },
      }),
      prisma.commission.groupBy({ by: ["affiliateId"], where: COUNTED, _sum: { base: true } }),
      prisma.commission.groupBy({ by: ["affiliateId"], where: COUNTED, _sum: { amount: true } }),
      prisma.affiliateClick.groupBy({ by: ["affiliateId"], _count: { _all: true } }),
      prisma.commission.groupBy({ by: ["affiliateId"], where: COUNTED, _count: { _all: true } }),
      prisma.commission.aggregate({ where: COUNTED, _sum: { amount: true } }),
      prisma.affiliateClick.count(),
    ]);

  const revMap = new Map(revByAff.map((r) => [r.affiliateId, r._sum.base ?? 0]));
  const commMap = new Map(commByAff.map((r) => [r.affiliateId, r._sum.amount ?? 0]));
  const clickMap = new Map(clicksByAff.map((r) => [r.affiliateId, r._count._all]));
  const orderMap = new Map(ordersByAff.map((r) => [r.affiliateId, r._count._all]));

  const rows = affiliates.map((a) => {
    const clicks = clickMap.get(a.id) ?? 0;
    const orders = orderMap.get(a.id) ?? 0;
    return {
      code: a.code,
      displayName: a.displayName,
      role: a.role,
      couponCode: a.coupon?.code ?? null,
      couponUses: a.coupon?.usedCount ?? 0,
      revenue: revMap.get(a.id) ?? 0,
      commission: commMap.get(a.id) ?? 0,
      clicks,
      orders,
      conversion: clicks > 0 ? orders / clicks : 0,
    };
  });

  const totalRevenue = [...revMap.values()].reduce((a, b) => a + b, 0);
  const totalOrders = [...orderMap.values()].reduce((a, b) => a + b, 0);

  return {
    totals: {
      activeAffiliates: affiliates.length,
      clicks: clicksTotal,
      orders: totalOrders,
      revenue: totalRevenue,
      commission: commTotal._sum.amount ?? 0,
    },
    topByCommission: [...rows].sort((a, b) => b.commission - a.commission).slice(0, 10),
    topByRevenue: [...rows].sort((a, b) => b.revenue - a.revenue).slice(0, 10),
    topByConversion: [...rows]
      .filter((r) => r.clicks >= 5)
      .sort((a, b) => b.conversion - a.conversion)
      .slice(0, 10),
    couponPerformance: [...rows]
      .filter((r) => r.couponCode)
      .sort((a, b) => b.couponUses - a.couponUses)
      .slice(0, 10),
  };
}
