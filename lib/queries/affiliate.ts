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

/** The current user's affiliate record (+ its coupon), or null. */
export async function getMyAffiliate(userId: string) {
  return prisma.affiliate.findUnique({
    where: { userId },
    include: { coupon: { select: { code: true, type: true, value: true, usedCount: true } } },
  });
}

export type MonthlyPoint = { month: string; clicks: number; orders: number; commission: number };

async function monthlySeries(affiliateId: string): Promise<MonthlyPoint[]> {
  const since = startOfMonth(subMonths(new Date(), 5));
  const [clicks, orders] = await Promise.all([
    prisma.affiliateClick.findMany({
      where: { affiliateId, createdAt: { gte: since } },
      select: { createdAt: true },
    }),
    prisma.order.findMany({
      where: { affiliateId, createdAt: { gte: since } },
      select: { createdAt: true, commission: { select: { amount: true } } },
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
      b.commission += o.commission?.amount ?? 0;
    }
  }
  return [...buckets.values()];
}

/** Full affiliate dashboard payload (stats + recent orders + payouts + coupon). */
export async function getAffiliateDashboard(affiliate: {
  id: string;
  couponId: string | null;
}) {
  const [clicks, clickIds, ordersCount, revenueAgg, balances, recentOrders, payouts, coupon, monthly] =
    await Promise.all([
      prisma.affiliateClick.count({ where: { affiliateId: affiliate.id } }),
      prisma.affiliateClick.findMany({
        where: { affiliateId: affiliate.id },
        select: { anonId: true, userId: true },
        take: 5000,
      }),
      prisma.order.count({ where: { affiliateId: affiliate.id } }),
      prisma.order.aggregate({
        where: { affiliateId: affiliate.id, paymentStatus: { in: ["PAID", "REFUNDED"] } },
        _sum: { total: true },
      }),
      affiliateBalances(affiliate.id),
      prisma.order.findMany({
        where: { affiliateId: affiliate.id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          orderNumber: true,
          total: true,
          status: true,
          createdAt: true,
          commission: { select: { amount: true, status: true } },
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
    ]);

  const uniqueVisitors = new Set(clickIds.map((c) => c.userId ?? c.anonId ?? "?")).size;
  const conversion = uniqueVisitors > 0 ? ordersCount / uniqueVisitors : 0;

  return {
    clicks,
    uniqueVisitors,
    orders: ordersCount,
    revenue: revenueAgg._sum.total ?? 0,
    conversion,
    balances,
    recentOrders,
    payouts,
    coupon,
    monthly,
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
      _count: { select: { commissions: true, clicks: true, orders: true } },
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
      payouts: { orderBy: { createdAt: "desc" }, take: 10 },
    },
  });
  if (!affiliate) return null;
  const [balances, stats] = await Promise.all([
    affiliateBalances(affiliate.id),
    Promise.all([
      prisma.affiliateClick.count({ where: { affiliateId: affiliate.id } }),
      prisma.order.count({ where: { affiliateId: affiliate.id } }),
      prisma.order.aggregate({
        where: { affiliateId: affiliate.id, paymentStatus: { in: ["PAID", "REFUNDED"] } },
        _sum: { total: true },
      }),
    ]).then(([clicks, orders, rev]) => ({ clicks, orders, revenue: rev._sum.total ?? 0 })),
  ]);
  return { affiliate, balances, stats };
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
      affiliate: {
        select: {
          code: true,
          displayName: true,
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

/** All commissions for the admin commission-management page (filterable + totals). */
export async function getAdminCommissions(f: AdminCommissionFilters = {}) {
  const where: Prisma.CommissionWhereInput = {};
  if (f.status && f.status !== "ALL") where.status = f.status as CommissionStatus;
  if (f.search?.trim()) {
    const q = f.search.trim();
    where.OR = [
      { order: { orderNumber: { contains: q, mode: "insensitive" } } },
      { affiliate: { code: { contains: q, mode: "insensitive" } } },
      { affiliate: { displayName: { contains: q, mode: "insensitive" } } },
    ];
  }

  const [commissions, totals] = await Promise.all([
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
  ]);

  const sumFor = (s: string) => totals.find((t) => t.status === s)?._sum.amount ?? 0;
  const countFor = (s: string) => totals.find((t) => t.status === s)?._count ?? 0;
  return {
    commissions,
    summary: {
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
      prisma.order.groupBy({
        by: ["affiliateId"],
        where: { affiliateId: { not: null }, paymentStatus: { in: ["PAID", "REFUNDED"] } },
        _sum: { total: true },
      }),
      prisma.commission.groupBy({ by: ["affiliateId"], _sum: { amount: true } }),
      prisma.affiliateClick.groupBy({ by: ["affiliateId"], _count: { _all: true } }),
      prisma.order.groupBy({
        by: ["affiliateId"],
        where: { affiliateId: { not: null } },
        _count: { _all: true },
      }),
      prisma.commission.aggregate({ _sum: { amount: true } }),
      prisma.affiliateClick.count(),
    ]);

  const revMap = new Map(revByAff.map((r) => [r.affiliateId, r._sum.total ?? 0]));
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
