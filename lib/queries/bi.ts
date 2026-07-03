import "server-only";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/redis";

/**
 * Business-intelligence aggregation layer. Lightweight + deterministic — every
 * metric is derived from the existing orders / products / users / carts /
 * affiliates / campaigns / returns data (no new tables, no AI required). The AI
 * layer (lib/ai/insights.ts) only narrates the numbers this produces.
 *
 * Revenue = gross sales of non-cancelled orders (excludes CANCELLED/RETURNED), so
 * pending/COD orders count. This is a read-only view; it changes no business logic.
 */

const DAY = 86_400_000;
/** Revenue-relevant order filter, shared with lib/queries/analytics.ts. */
export const NOT_CANCELLED: Prisma.EnumOrderStatusFilter = { notIn: ["CANCELLED", "RETURNED"] };

export type Period = { revenue: number; orders: number };
export type GrowthPeriod = Period & { prevRevenue: number; prevOrders: number; revenueGrowth: number; orderGrowth: number };
export type TrendPoint = { date: string; revenue: number; orders: number };
export type RankRow = { id: string; name: string; value: number; sub?: string };
export type Alert = { level: "critical" | "warning" | "info"; title: string; detail: string };

export type BusinessIntelligence = {
  generatedAt: string;
  currency: "paise";
  summary: { today: Period; week: GrowthPeriod; month: GrowthPeriod; year: Period };
  trend: TrendPoint[]; // last 30 days
  forecast: { monthProjected: number; monthSoFar: number; runRatePerDay: number; daysElapsed: number; daysInMonth: number };
  customers: {
    total: number;
    withOrders: number;
    new: number; // first order in last 30d
    returning: number; // >=2 orders
    inactive: number; // last order > 60d ago
    highValue: number; // lifetime spend >= threshold
    repeatRate: number; // returning / withOrders
    newPerDay: { date: string; count: number }[];
    topCustomers: RankRow[];
  };
  inventory: {
    lowStock: number;
    outOfStock: number;
    predictedStockouts: { id: string; name: string; stock: number; perDay: number; daysLeft: number }[];
  };
  products: {
    trending: RankRow[]; // biggest unit-sales gainers (30d vs prev 30d)
    declining: RankRow[];
    bestByCategory: RankRow[];
    promote: RankRow[]; // high views, low conversion → advertise
  };
  cart: { abandonedCarts: number; cartAdds30d: number; purchases30d: number; abandonmentRate: number };
  affiliates: { active: number; revenue90d: number; orders90d: number; top: RankRow[] };
  campaigns: { sent: number; delivered: number; opened: number; clicked: number; conversions: number; revenue: number; openRate: number; clickRate: number };
  refunds: { count30d: number; amount30d: number; rate: number };
  bestTime: { day: string; hour: string };
  alerts: Alert[];
};

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

/** Sum a pre-fetched orders array within [from, to). */
function sumRange(
  orders: { total: number; createdAt: Date }[],
  from: Date,
  to: Date,
): Period {
  let revenue = 0;
  let count = 0;
  for (const o of orders) {
    if (o.createdAt >= from && o.createdAt < to) {
      revenue += o.total;
      count++;
    }
  }
  return { revenue, orders: count };
}

function pct(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/** Safe zeroed snapshot — rendered (with a friendly alert) if the data can't load,
 *  so the dashboard never crashes on a DB outage / Neon cold start / empty store. */
function emptyBI(): BusinessIntelligence {
  const z: Period = { revenue: 0, orders: 0 };
  const gz: GrowthPeriod = { revenue: 0, orders: 0, prevRevenue: 0, prevOrders: 0, revenueGrowth: 0, orderGrowth: 0 };
  return {
    generatedAt: new Date().toISOString(),
    currency: "paise",
    summary: { today: z, week: gz, month: gz, year: z },
    trend: [],
    forecast: { monthProjected: 0, monthSoFar: 0, runRatePerDay: 0, daysElapsed: 1, daysInMonth: 30 },
    customers: { total: 0, withOrders: 0, new: 0, returning: 0, inactive: 0, highValue: 0, repeatRate: 0, newPerDay: [], topCustomers: [] },
    inventory: { lowStock: 0, outOfStock: 0, predictedStockouts: [] },
    products: { trending: [], declining: [], bestByCategory: [], promote: [] },
    cart: { abandonedCarts: 0, cartAdds30d: 0, purchases30d: 0, abandonmentRate: 0 },
    affiliates: { active: 0, revenue90d: 0, orders90d: 0, top: [] },
    campaigns: { sent: 0, delivered: 0, opened: 0, clicked: 0, conversions: 0, revenue: 0, openRate: 0, clickRate: 0 },
    refunds: { count30d: 0, amount30d: 0, rate: 0 },
    bestTime: { day: "—", hour: "—" },
    alerts: [{ level: "info", title: "Insights temporarily unavailable", detail: "Couldn't load store data just now — please refresh in a moment." }],
  };
}

/**
 * Never throws. Computes the BI snapshot with a one-shot retry (Neon scales to zero
 * and the first query after idle can throw P1001 — retrying warms it up), and falls
 * back to a safe empty snapshot on persistent failure so the page always renders.
 */
export async function getBusinessIntelligence(): Promise<BusinessIntelligence> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      // Read-through cache (no-op without Redis). BI is plain JSON (no Dates).
      return await cached("bi:v1", 180, computeBI);
    } catch (err) {
      console.error(`[bi] computeBI failed (attempt ${attempt + 1}/2):`, err);
      if (attempt === 0) await new Promise((r) => setTimeout(r, 400));
    }
  }
  return emptyBI();
}

async function computeBI(): Promise<BusinessIntelligence> {
  const now = new Date();
  const startToday = new Date(now);
  startToday.setHours(0, 0, 0, 0);
  const d7 = new Date(now.getTime() - 7 * DAY);
  const d14 = new Date(now.getTime() - 14 * DAY);
  const d30 = new Date(now.getTime() - 30 * DAY);
  const d60 = new Date(now.getTime() - 60 * DAY);
  const d90 = new Date(now.getTime() - 90 * DAY);
  const d365 = new Date(now.getTime() - 365 * DAY);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();

  const [
    orders90,
    yearAgg,
    userGroups,
    totalCustomers,
    itemsThis,
    itemsPrev,
    lowVariants,
    velocity,
    abandonedCarts,
    cartAdds30d,
    purchases30d,
    affiliateGroups,
    campaignAgg,
    refundAgg,
    viewEvents,
  ] = await Promise.all([
    prisma.order.findMany({
      where: { status: NOT_CANCELLED, createdAt: { gte: d90 } },
      select: { total: true, createdAt: true, userId: true, affiliateId: true },
      orderBy: { createdAt: "asc" },
      take: 20_000,
    }),
    prisma.order.aggregate({ where: { status: NOT_CANCELLED, createdAt: { gte: d365 } }, _sum: { total: true }, _count: { _all: true } }),
    prisma.order.groupBy({
      by: ["userId"],
      where: { status: NOT_CANCELLED },
      _sum: { total: true },
      _count: { _all: true },
      _max: { createdAt: true },
      _min: { createdAt: true },
    }),
    prisma.user.count({ where: { role: "USER" } }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { status: NOT_CANCELLED, createdAt: { gte: d30 } }, productId: { not: null } },
      _sum: { quantity: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId"],
      where: { order: { status: NOT_CANCELLED, createdAt: { gte: d60, lt: d30 } }, productId: { not: null } },
      _sum: { quantity: true },
    }),
    prisma.productVariant.findMany({
      where: { isActive: true, stock: { lte: 5 } },
      select: { id: true, stock: true, weightLabel: true, product: { select: { name: true } } },
      orderBy: { stock: "asc" },
      take: 100,
    }),
    prisma.orderItem.groupBy({
      by: ["variantId"],
      where: { order: { status: NOT_CANCELLED, createdAt: { gte: d30 } } },
      _sum: { quantity: true },
    }),
    prisma.cart.count({ where: { items: { some: {} } } }),
    prisma.userEvent.count({ where: { type: "CART_ADD", createdAt: { gte: d30 } } }).catch(() => 0),
    prisma.userEvent.count({ where: { type: "PURCHASE", createdAt: { gte: d30 } } }).catch(() => 0),
    prisma.order.groupBy({
      by: ["affiliateId"],
      where: { status: NOT_CANCELLED, createdAt: { gte: d90 }, affiliateId: { not: null } },
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.campaign.aggregate({
      where: { status: "SENT" },
      _sum: { sentCount: true, deliveredCount: true, openCount: true, clickCount: true, conversionCount: true, revenue: true },
    }),
    prisma.returnRequest.aggregate({ where: { createdAt: { gte: d30 } }, _count: { _all: true }, _sum: { refundedAmount: true } }),
    prisma.userEvent.groupBy({ by: ["productId"], where: { type: "PRODUCT_VIEW", createdAt: { gte: d30 }, productId: { not: null } }, _count: { _all: true } }).catch(() => [] as { productId: string | null; _count: { _all: number } }[]),
  ]);

  // --- Sales summary + growth ---
  const today = sumRange(orders90, startToday, now);
  const week = sumRange(orders90, d7, now);
  const weekPrev = sumRange(orders90, d14, d7);
  const month = sumRange(orders90, d30, now);
  const monthPrev = sumRange(orders90, d60, d30);
  const summary = {
    today,
    week: { ...week, prevRevenue: weekPrev.revenue, prevOrders: weekPrev.orders, revenueGrowth: pct(week.revenue, weekPrev.revenue), orderGrowth: pct(week.orders, weekPrev.orders) },
    month: { ...month, prevRevenue: monthPrev.revenue, prevOrders: monthPrev.orders, revenueGrowth: pct(month.revenue, monthPrev.revenue), orderGrowth: pct(month.orders, monthPrev.orders) },
    year: { revenue: yearAgg._sum.total ?? 0, orders: yearAgg._count._all },
  };

  // --- Daily trend (last 30 days) ---
  const trendMap = new Map<string, TrendPoint>();
  for (let i = 29; i >= 0; i--) {
    const day = iso(new Date(now.getTime() - i * DAY));
    trendMap.set(day, { date: day, revenue: 0, orders: 0 });
  }
  for (const o of orders90) {
    if (o.createdAt < d30) continue;
    const key = iso(o.createdAt);
    const t = trendMap.get(key);
    if (t) {
      t.revenue += o.total;
      t.orders++;
    }
  }
  const trend = [...trendMap.values()];

  // --- Forecast (run-rate this calendar month) ---
  const monthSoFar = sumRange(orders90, monthStart, now).revenue;
  const daysElapsed = Math.max(1, Math.ceil((now.getTime() - monthStart.getTime()) / DAY));
  const runRatePerDay = monthSoFar / daysElapsed;
  const forecast = { monthProjected: Math.round(runRatePerDay * daysInMonth), monthSoFar, runRatePerDay: Math.round(runRatePerDay), daysElapsed, daysInMonth };

  // --- Customer segmentation ---
  const withOrders = userGroups.filter((g) => g.userId);
  const HIGH_VALUE = 1_000_000; // ≥ ₹10,000 lifetime
  let newC = 0, returning = 0, inactive = 0, highValue = 0;
  for (const g of withOrders) {
    const spend = g._sum?.total ?? 0;
    const orders = g._count?._all ?? 0;
    const first = g._min?.createdAt ?? null;
    const last = g._max?.createdAt ?? null;
    if (first && first >= d30) newC++;
    if (orders >= 2) returning++;
    if (last && last < d60) inactive++;
    if (spend >= HIGH_VALUE) highValue++;
  }
  const topCustomers: RankRow[] = [...withOrders]
    .sort((a, b) => (b._sum?.total ?? 0) - (a._sum?.total ?? 0))
    .slice(0, 5)
    .map((g) => ({ id: g.userId, name: "", value: g._sum?.total ?? 0, sub: `${g._count?._all ?? 0} orders` }));
  // Resolve top customer names.
  if (topCustomers.length) {
    const users = await prisma.user.findMany({ where: { id: { in: topCustomers.map((c) => c.id) } }, select: { id: true, name: true, email: true } });
    const byId = new Map(users.map((u) => [u.id, u.name || u.email || "Customer"]));
    for (const c of topCustomers) c.name = byId.get(c.id) ?? "Customer";
  }
  const newPerDayMap = new Map<string, number>();
  for (let i = 13; i >= 0; i--) newPerDayMap.set(iso(new Date(now.getTime() - i * DAY)), 0);
  for (const g of withOrders) {
    if (g._min?.createdAt && g._min.createdAt >= d14) {
      const k = iso(g._min.createdAt);
      if (newPerDayMap.has(k)) newPerDayMap.set(k, (newPerDayMap.get(k) ?? 0) + 1);
    }
  }
  const customers = {
    total: totalCustomers,
    withOrders: withOrders.length,
    new: newC,
    returning,
    inactive,
    highValue,
    repeatRate: withOrders.length ? (returning / withOrders.length) * 100 : 0,
    newPerDay: [...newPerDayMap.entries()].map(([date, count]) => ({ date, count })),
    topCustomers,
  };

  // --- Product trending / declining / best-by-category / promote ---
  const productIds = new Set<string>();
  for (const g of itemsThis) if (g.productId) productIds.add(g.productId);
  for (const g of itemsPrev) if (g.productId) productIds.add(g.productId);
  for (const g of viewEvents) if (g.productId) productIds.add(g.productId);
  const prods = productIds.size
    ? await prisma.product.findMany({ where: { id: { in: [...productIds] } }, select: { id: true, name: true, category: { select: { name: true } } } })
    : [];
  const prodMap = new Map(prods.map((p) => [p.id, p]));
  const thisQty = new Map(itemsThis.map((g) => [g.productId!, g._sum?.quantity ?? 0]));
  const prevQty = new Map(itemsPrev.map((g) => [g.productId!, g._sum?.quantity ?? 0]));
  const deltas: { id: string; name: string; delta: number; now: number }[] = [];
  for (const id of new Set([...thisQty.keys(), ...prevQty.keys()])) {
    const t = thisQty.get(id) ?? 0;
    const p = prevQty.get(id) ?? 0;
    deltas.push({ id, name: prodMap.get(id)?.name ?? "Product", delta: t - p, now: t });
  }
  const trending: RankRow[] = deltas.filter((d) => d.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, 5).map((d) => ({ id: d.id, name: d.name, value: d.now, sub: `+${d.delta} vs prev` }));
  const declining: RankRow[] = deltas.filter((d) => d.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, 5).map((d) => ({ id: d.id, name: d.name, value: d.now, sub: `${d.delta} vs prev` }));
  const catTotals = new Map<string, number>();
  for (const [id, qty] of thisQty) {
    const cat = prodMap.get(id)?.category?.name ?? "Uncategorized";
    catTotals.set(cat, (catTotals.get(cat) ?? 0) + qty);
  }
  const bestByCategory: RankRow[] = [...catTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6).map(([name, value]) => ({ id: name, name, value, sub: "units (30d)" }));
  // Promote: most-viewed with weak sales (high views, low units).
  const viewCount = new Map(viewEvents.map((g) => [g.productId!, g._count?._all ?? 0]));
  const promote: RankRow[] = [...viewCount.entries()]
    .map(([id, views]) => ({ id, views, sold: thisQty.get(id) ?? 0 }))
    .filter((x) => x.views >= 5 && x.sold <= Math.max(1, x.views * 0.1))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5)
    .map((x) => ({ id: x.id, name: prodMap.get(x.id)?.name ?? "Product", value: x.views, sub: `${x.views} views · ${x.sold} sold` }));

  // --- Inventory forecast ---
  const soldByVariant = new Map(velocity.map((g) => [g.variantId, g._sum?.quantity ?? 0]));
  const outOfStock = lowVariants.filter((v) => v.stock <= 0).length;
  const predictedStockouts = lowVariants
    .filter((v) => v.stock > 0)
    .map((v) => {
      const perDay = (soldByVariant.get(v.id) ?? 0) / 30;
      const daysLeft = perDay > 0 ? Math.round(v.stock / perDay) : Infinity;
      return { id: v.id, name: `${v.product.name} · ${v.weightLabel}`, stock: v.stock, perDay: Number(perDay.toFixed(2)), daysLeft };
    })
    .filter((v) => v.daysLeft <= 14)
    .sort((a, b) => a.daysLeft - b.daysLeft)
    .slice(0, 8);
  const inventory = { lowStock: lowVariants.length, outOfStock, predictedStockouts };

  // --- Cart abandonment ---
  const abandonmentRate = cartAdds30d > 0 ? Math.max(0, ((cartAdds30d - purchases30d) / cartAdds30d) * 100) : 0;
  const cart = { abandonedCarts, cartAdds30d, purchases30d, abandonmentRate };

  // --- Affiliates ---
  const affTop = affiliateGroups.sort((a, b) => (b._sum?.total ?? 0) - (a._sum?.total ?? 0)).slice(0, 5);
  const affIds = affTop.map((a) => a.affiliateId).filter((x): x is string => !!x);
  const affs = affIds.length ? await prisma.affiliate.findMany({ where: { id: { in: affIds } }, select: { id: true, displayName: true, code: true } }) : [];
  const affMap = new Map(affs.map((a) => [a.id, a]));
  const affiliates = {
    active: affiliateGroups.length,
    revenue90d: affiliateGroups.reduce((n, a) => n + (a._sum?.total ?? 0), 0),
    orders90d: affiliateGroups.reduce((n, a) => n + (a._count?._all ?? 0), 0),
    top: affTop.map((a) => ({ id: a.affiliateId ?? "", name: affMap.get(a.affiliateId ?? "")?.displayName ?? "Affiliate", value: a._sum?.total ?? 0, sub: `${a._count?._all ?? 0} orders` })),
  };

  // --- Campaigns ---
  const cs = campaignAgg._sum;
  const campaigns = {
    sent: cs.sentCount ?? 0,
    delivered: cs.deliveredCount ?? 0,
    opened: cs.openCount ?? 0,
    clicked: cs.clickCount ?? 0,
    conversions: cs.conversionCount ?? 0,
    revenue: cs.revenue ?? 0,
    openRate: (cs.deliveredCount ?? 0) > 0 ? ((cs.openCount ?? 0) / (cs.deliveredCount ?? 1)) * 100 : 0,
    clickRate: (cs.deliveredCount ?? 0) > 0 ? ((cs.clickCount ?? 0) / (cs.deliveredCount ?? 1)) * 100 : 0,
  };

  // --- Refunds ---
  const refundCount = refundAgg._count._all;
  const refunds = { count30d: refundCount, amount30d: refundAgg._sum.refundedAmount ?? 0, rate: month.orders > 0 ? (refundCount / month.orders) * 100 : 0 };

  // --- Best time/day to promote ---
  const dowRev = new Array(7).fill(0);
  const hourRev = new Array(24).fill(0);
  for (const o of orders90) {
    dowRev[o.createdAt.getDay()] += o.total;
    hourRev[o.createdAt.getHours()] += o.total;
  }
  const bestDay = dowRev.indexOf(Math.max(...dowRev));
  const bestHour = hourRev.indexOf(Math.max(...hourRev));
  const bestTime = { day: DOW[bestDay], hour: `${String(bestHour).padStart(2, "0")}:00` };

  // --- Smart alerts (rule-based) ---
  const alerts: Alert[] = [];
  if (summary.week.revenueGrowth <= -20) alerts.push({ level: "critical", title: "Sales dropping", detail: `Weekly revenue is down ${Math.abs(summary.week.revenueGrowth).toFixed(0)}% vs the previous week.` });
  else if (summary.week.revenueGrowth >= 25) alerts.push({ level: "info", title: "Sales surging", detail: `Weekly revenue is up ${summary.week.revenueGrowth.toFixed(0)}% — consider scaling stock and ads.` });
  if (refunds.rate >= 10) alerts.push({ level: "warning", title: "High refund rate", detail: `${refunds.rate.toFixed(0)}% of this month's orders had a return/refund (${refunds.count30d}).` });
  if (outOfStock > 0) alerts.push({ level: "critical", title: "Out-of-stock items", detail: `${outOfStock} active variant(s) are out of stock.` });
  if (predictedStockouts.length > 0) alerts.push({ level: "warning", title: "Restock soon", detail: `${predictedStockouts.length} item(s) will sell out within 2 weeks at the current rate.` });
  if (abandonmentRate >= 60 && cartAdds30d >= 10) alerts.push({ level: "warning", title: "High cart abandonment", detail: `~${abandonmentRate.toFixed(0)}% of carts didn't convert — a recovery campaign could help.` });
  if (alerts.length === 0) alerts.push({ level: "info", title: "All clear", detail: "No anomalies detected across sales, inventory, refunds and carts." });

  return {
    generatedAt: now.toISOString(),
    currency: "paise",
    summary,
    trend,
    forecast,
    customers,
    inventory,
    products: { trending, declining, bestByCategory, promote },
    cart,
    affiliates,
    campaigns,
    refunds,
    bestTime,
    alerts,
  };
}
