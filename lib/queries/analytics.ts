import "server-only";
import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/redis";
import { NOT_CANCELLED, type RankRow } from "@/lib/queries/bi";

/**
 * Range-scoped storefront analytics: conversion funnel, KPI cards with deltas,
 * geo/device/traffic breakdowns and cart recovery — the data behind the new
 * BI-dashboard sections on /admin/insights. Additive companion to lib/queries/bi.ts
 * (which keeps its fixed windows); everything here is scoped to an admin-chosen
 * date range and compared against the same-length window immediately before it.
 *
 * All outputs are plain JSON (no Date instances) so they can round-trip the
 * Redis read-through cache. Every metric degrades to zeros / placeholder flags
 * when the underlying events don't exist yet (fresh tracking).
 */

const DAY = 86_400_000;

export type RangeKey = "today" | "yesterday" | "7d" | "30d" | "custom";
export type RangeInput = { range?: string; from?: string; to?: string };

export type ResolvedRange = {
  key: RangeKey;
  from: Date;
  to: Date; // exclusive
  prevFrom: Date;
  prevTo: Date;
  days: number;
  label: string;
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function fmtDay(d: Date): string {
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** Resolve the admin's range selection; garbage falls back to the 30-day default. */
export function resolveRange(input: RangeInput): ResolvedRange {
  const now = new Date();
  const todayStart = startOfDay(now);
  const key = (["today", "yesterday", "7d", "30d", "custom"] as const).find(
    (k) => k === input.range,
  ) ?? "30d";

  let from: Date;
  let to: Date;
  let label: string;
  switch (key) {
    case "today":
      from = todayStart;
      to = new Date(todayStart.getTime() + DAY);
      label = "Today";
      break;
    case "yesterday":
      from = new Date(todayStart.getTime() - DAY);
      to = todayStart;
      label = "Yesterday";
      break;
    case "7d":
      from = new Date(todayStart.getTime() - 6 * DAY);
      to = new Date(todayStart.getTime() + DAY);
      label = "Last 7 days";
      break;
    case "custom": {
      if (input.from && input.to && DATE_RE.test(input.from) && DATE_RE.test(input.to)) {
        const f = startOfDay(new Date(`${input.from}T00:00:00`));
        const t = startOfDay(new Date(`${input.to}T00:00:00`));
        if (!Number.isNaN(f.getTime()) && !Number.isNaN(t.getTime()) && t >= f) {
          from = f;
          to = new Date(t.getTime() + DAY); // to-date inclusive
          if (to.getTime() - from.getTime() > 366 * DAY) {
            from = new Date(to.getTime() - 366 * DAY);
          }
          label = `${fmtDay(from)} – ${fmtDay(new Date(to.getTime() - 1))}`;
          break;
        }
      }
      // Unparsable custom input → default window.
      from = new Date(todayStart.getTime() - 29 * DAY);
      to = new Date(todayStart.getTime() + DAY);
      label = "Last 30 days";
      break;
    }
    default:
      from = new Date(todayStart.getTime() - 29 * DAY);
      to = new Date(todayStart.getTime() + DAY);
      label = "Last 30 days";
  }

  const spanMs = to.getTime() - from.getTime();
  return {
    key,
    from,
    to,
    prevFrom: new Date(from.getTime() - spanMs),
    prevTo: from,
    days: Math.max(1, Math.round(spanMs / DAY)),
    label,
  };
}

export type FunnelStage = {
  key: "visitors" | "productViews" | "cartAdds" | "checkoutStarts" | "orders" | "delivered";
  label: string;
  count: number;
  sub?: string;
  convPct: number | null; // vs previous stage
  dropPct: number | null;
  deltaPct: number | null; // vs previous period
  pending?: boolean; // event tracking just enabled, no data anywhere yet
};

export type Kpi = {
  key: string;
  label: string;
  value: number;
  prev: number;
  deltaPct: number | null;
  series?: number[]; // daily buckets within the range
  kind: "count" | "money" | "pct";
  note?: string;
};

export type RangeAnalytics = {
  range: { key: RangeKey; fromISO: string; toISO: string; days: number; label: string };
  funnel: FunnelStage[];
  kpis: Kpi[];
  topProducts: {
    mostViewed: RankRow[];
    mostCartAdded: RankRow[];
    mostPurchased: RankRow[];
    highestRevenue: RankRow[];
    lowestConversion: RankRow[];
  };
  geo: { cities: RankRow[]; states: RankRow[] };
  devices: RankRow[];
  sources: RankRow[];
  recovery: { logs: number; recoveredCarts: number; recoveredRevenue: number };
  flags: {
    hasVisitorData: boolean;
    hasCheckoutData: boolean;
    hasDeviceData: boolean;
    hasSourceData: boolean;
  };
};

function pct(cur: number, prev: number): number {
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

function delta(cur: number, prev: number): number | null {
  if (cur === 0 && prev === 0) return null;
  return pct(cur, prev);
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10);
}

function titleCase(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Classify an external referrer hostname into a friendly traffic source. */
export function classifySource(host: string | null): string {
  if (!host) return "Direct";
  const h = host.toLowerCase();
  if (h.includes("instagram")) return "Instagram";
  if (h.includes("facebook") || h === "fb.com" || h.startsWith("l.facebook")) return "Facebook";
  if (h.includes("whatsapp") || h === "wa.me") return "WhatsApp";
  if (h.includes("google")) return "Google";
  if (h.includes("youtube") || h === "youtu.be") return "YouTube";
  if (h === "t.co" || h.includes("twitter") || h === "x.com") return "X (Twitter)";
  if (h.includes("linkedin") || h === "lnkd.in") return "LinkedIn";
  if (h.includes("pinterest")) return "Pinterest";
  if (h === "t.me" || h.includes("telegram")) return "Telegram";
  if (h.includes("bing")) return "Bing";
  if (h.includes("duckduckgo")) return "DuckDuckGo";
  return "Other";
}

function emptyRangeAnalytics(r: ResolvedRange): RangeAnalytics {
  return {
    range: { key: r.key, fromISO: r.from.toISOString(), toISO: r.to.toISOString(), days: r.days, label: r.label },
    funnel: [],
    kpis: [],
    topProducts: { mostViewed: [], mostCartAdded: [], mostPurchased: [], highestRevenue: [], lowestConversion: [] },
    geo: { cities: [], states: [] },
    devices: [],
    sources: [],
    recovery: { logs: 0, recoveredCarts: 0, recoveredRevenue: 0 },
    flags: { hasVisitorData: false, hasCheckoutData: false, hasDeviceData: false, hasSourceData: false },
  };
}

/**
 * Never throws: one-shot retry (Neon cold start), then a zeroed snapshot so the
 * dashboard always renders. Cached briefly per range (no-op without Redis).
 */
export async function getRangeAnalytics(input: RangeInput): Promise<RangeAnalytics> {
  const r = resolveRange(input);
  const key = `analytics:v1:${r.key}:${iso(r.from)}:${iso(r.to)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await cached(key, 120, () => computeRangeAnalytics(r));
    } catch (err) {
      console.error(`[analytics] compute failed (attempt ${attempt + 1}/2):`, err);
      if (attempt === 0) await new Promise((res) => setTimeout(res, 400));
    }
  }
  return emptyRangeAnalytics(r);
}

type EventRow = {
  type: string;
  userId: string | null;
  anonId: string | null;
  productId: string | null;
  device: string | null;
  referrer: string | null;
  createdAt: Date;
};

const identity = (e: { userId: string | null; anonId: string | null }) =>
  e.userId ?? e.anonId ?? null;

async function computeRangeAnalytics(r: ResolvedRange): Promise<RangeAnalytics> {
  const [events, orders, orderItems, abandonLogs] = await Promise.all([
    prisma.userEvent.findMany({
      where: { createdAt: { gte: r.prevFrom, lt: r.to } },
      select: {
        type: true,
        userId: true,
        anonId: true,
        productId: true,
        device: true,
        referrer: true,
        createdAt: true,
      },
      take: 50_000,
    }) as Promise<EventRow[]>,
    prisma.order.findMany({
      where: { status: NOT_CANCELLED, createdAt: { gte: r.prevFrom, lt: r.to } },
      select: { total: true, createdAt: true, status: true, userId: true, shippingAddress: true },
      take: 20_000,
    }),
    prisma.orderItem.findMany({
      where: { order: { status: NOT_CANCELLED, createdAt: { gte: r.from, lt: r.to } } },
      select: { productId: true, productName: true, price: true, quantity: true },
      take: 20_000,
    }),
    prisma.automationLog
      .findMany({
        where: { createdAt: { gte: r.from, lt: r.to }, rule: { trigger: "ABANDONED_CART" } },
        select: { userId: true, createdAt: true },
        take: 5_000,
      })
      .catch(() => [] as { userId: string | null; createdAt: Date }[]),
  ]);

  const cur = (x: { createdAt: Date }) => x.createdAt >= r.from;
  const curEvents = events.filter(cur);
  const prevEvents = events.filter((e) => !cur(e));
  const curOrders = orders.filter(cur);
  const prevOrders = orders.filter((o) => !cur(o));

  // --- Distinct-identity sets per event type, per window ---
  const idsBy = (rows: EventRow[], type?: string) => {
    const s = new Set<string>();
    for (const e of rows) {
      if (type && e.type !== type) continue;
      const id = identity(e);
      if (id) s.add(id);
    }
    return s;
  };
  const visitorsCur = idsBy(curEvents);
  const visitorsPrev = idsBy(prevEvents);
  const viewersCur = idsBy(curEvents, "PRODUCT_VIEW");
  const viewersPrev = idsBy(prevEvents, "PRODUCT_VIEW");
  const cartersCur = idsBy(curEvents, "CART_ADD");
  const cartersPrev = idsBy(prevEvents, "CART_ADD");
  const checkersCur = idsBy(curEvents, "CHECKOUT_START");
  const checkersPrev = idsBy(prevEvents, "CHECKOUT_START");
  const buyersCur = new Set(curOrders.map((o) => o.userId).filter((x): x is string => !!x));
  const buyersPrev = new Set(prevOrders.map((o) => o.userId).filter((x): x is string => !!x));
  const deliveredCurOrders = curOrders.filter((o) => o.status === "DELIVERED");
  const deliveredPrevOrders = prevOrders.filter((o) => o.status === "DELIVERED");
  const deliveredCur = new Set(deliveredCurOrders.map((o) => o.userId).filter((x): x is string => !!x));
  const deliveredPrev = new Set(deliveredPrevOrders.map((o) => o.userId).filter((x): x is string => !!x));

  const countBy = (rows: EventRow[], type: string) => rows.filter((e) => e.type === type).length;

  // Tracking-just-enabled flags (any data ever in the fetched span).
  const hasVisitorData = events.some((e) => e.type === "PAGE_VIEW");
  const hasCheckoutData = events.some((e) => e.type === "CHECKOUT_START");
  const hasDeviceData = events.some((e) => !!e.device);
  const hasSourceData = events.some((e) => e.type === "PAGE_VIEW");

  // --- Funnel ---
  const stagesRaw: {
    key: FunnelStage["key"];
    label: string;
    curN: number;
    prevN: number;
    sub?: string;
    pending?: boolean;
  }[] = [
    {
      key: "visitors",
      label: "Visitors",
      curN: visitorsCur.size,
      prevN: visitorsPrev.size,
      sub: hasVisitorData ? undefined : "shoppers with any tracked activity",
    },
    {
      key: "productViews",
      label: "Product views",
      curN: viewersCur.size,
      prevN: viewersPrev.size,
      sub: `${countBy(curEvents, "PRODUCT_VIEW")} view events`,
    },
    { key: "cartAdds", label: "Added to cart", curN: cartersCur.size, prevN: cartersPrev.size },
    {
      key: "checkoutStarts",
      label: "Checkout started",
      curN: checkersCur.size,
      prevN: checkersPrev.size,
      pending: !hasCheckoutData,
    },
    {
      key: "orders",
      label: "Order placed",
      curN: buyersCur.size,
      prevN: buyersPrev.size,
      sub: `${curOrders.length} orders`,
    },
    {
      key: "delivered",
      label: "Delivered",
      curN: deliveredCur.size,
      prevN: deliveredPrev.size,
      sub: `${deliveredCurOrders.length} of this period's orders`,
    },
  ];
  const funnel: FunnelStage[] = stagesRaw.map((s, i) => {
    const prevStage = i > 0 ? stagesRaw[i - 1] : null;
    const convPct =
      prevStage && prevStage.curN > 0 && !s.pending ? (s.curN / prevStage.curN) * 100 : null;
    return {
      key: s.key,
      label: s.label,
      count: s.curN,
      sub: s.sub,
      convPct,
      dropPct: convPct === null ? null : Math.max(0, 100 - convPct),
      deltaPct: s.pending ? null : delta(s.curN, s.prevN),
      pending: s.pending || undefined,
    };
  });

  // --- Daily series within the range (KPI sparklines) ---
  const seriesOf = (fn: (day: string) => number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < r.days; i++) {
      out.push(fn(iso(new Date(r.from.getTime() + i * DAY))));
    }
    return out;
  };
  const dayKey = (d: Date) => iso(d);
  const eventDayCounts = (type: string) => {
    const m = new Map<string, number>();
    for (const e of curEvents) if (e.type === type) m.set(dayKey(e.createdAt), (m.get(dayKey(e.createdAt)) ?? 0) + 1);
    return m;
  };
  const visitorsByDay = new Map<string, Set<string>>();
  for (const e of curEvents) {
    const id = identity(e);
    if (!id) continue;
    const k = dayKey(e.createdAt);
    if (!visitorsByDay.has(k)) visitorsByDay.set(k, new Set());
    visitorsByDay.get(k)!.add(id);
  }
  const ordersByDay = new Map<string, { n: number; rev: number }>();
  for (const o of curOrders) {
    const k = dayKey(o.createdAt);
    const b = ordersByDay.get(k) ?? { n: 0, rev: 0 };
    b.n++;
    b.rev += o.total;
    ordersByDay.set(k, b);
  }

  // --- KPI values ---
  const revenueCur = curOrders.reduce((n, o) => n + o.total, 0);
  const revenuePrev = prevOrders.reduce((n, o) => n + o.total, 0);
  const aovCur = curOrders.length ? Math.round(revenueCur / curOrders.length) : 0;
  const aovPrev = prevOrders.length ? Math.round(revenuePrev / prevOrders.length) : 0;
  const convCur = visitorsCur.size ? (buyersCur.size / visitorsCur.size) * 100 : 0;
  const convPrev = visitorsPrev.size ? (buyersPrev.size / visitorsPrev.size) * 100 : 0;
  const abandonCur = cartersCur.size
    ? Math.max(0, ((cartersCur.size - buyersCur.size) / cartersCur.size) * 100)
    : 0;
  const abandonPrev = cartersPrev.size
    ? Math.max(0, ((cartersPrev.size - buyersPrev.size) / cartersPrev.size) * 100)
    : 0;

  // Bounce = identities with exactly one event in the range.
  const eventCountPerId = new Map<string, number>();
  for (const e of curEvents) {
    const id = identity(e);
    if (id) eventCountPerId.set(id, (eventCountPerId.get(id) ?? 0) + 1);
  }
  let singles = 0;
  for (const n of eventCountPerId.values()) if (n === 1) singles++;
  const bounceCur = visitorsCur.size ? (singles / visitorsCur.size) * 100 : 0;
  const prevCountPerId = new Map<string, number>();
  for (const e of prevEvents) {
    const id = identity(e);
    if (id) prevCountPerId.set(id, (prevCountPerId.get(id) ?? 0) + 1);
  }
  let prevSingles = 0;
  for (const n of prevCountPerId.values()) if (n === 1) prevSingles++;
  const bouncePrev = visitorsPrev.size ? (prevSingles / visitorsPrev.size) * 100 : 0;

  // Returning visitors = seen in both windows.
  let returningCur = 0;
  for (const id of visitorsCur) if (visitorsPrev.has(id)) returningCur++;

  // New vs repeat customers (first-ever order inside the range?).
  const buyerIds = [...new Set([...buyersCur])];
  const firstOrders = buyerIds.length
    ? await prisma.order.groupBy({
        by: ["userId"],
        where: { status: NOT_CANCELLED, userId: { in: buyerIds } },
        _min: { createdAt: true },
      })
    : [];
  let newCustomers = 0;
  for (const g of firstOrders) {
    if (g._min?.createdAt && g._min.createdAt >= r.from) newCustomers++;
  }
  const repeatCustomers = buyersCur.size - newCustomers;

  const viewsDay = eventDayCounts("PRODUCT_VIEW");
  const cartsDay = eventDayCounts("CART_ADD");
  const checkoutsDay = eventDayCounts("CHECKOUT_START");
  const showSeries = r.days >= 3; // sparkline is noise for 1-day ranges

  const kpis: Kpi[] = [
    {
      key: "visitors",
      label: "Visitors",
      value: visitorsCur.size,
      prev: visitorsPrev.size,
      deltaPct: delta(visitorsCur.size, visitorsPrev.size),
      series: showSeries ? seriesOf((d) => visitorsByDay.get(d)?.size ?? 0) : undefined,
      kind: "count",
      note: hasVisitorData ? undefined : "Shoppers with any tracked activity",
    },
    {
      key: "returning",
      label: "Returning visitors",
      value: returningCur,
      prev: 0,
      deltaPct: null,
      kind: "count",
      note: "Also seen in the previous period",
    },
    {
      key: "productViews",
      label: "Product views",
      value: countBy(curEvents, "PRODUCT_VIEW"),
      prev: countBy(prevEvents, "PRODUCT_VIEW"),
      deltaPct: delta(countBy(curEvents, "PRODUCT_VIEW"), countBy(prevEvents, "PRODUCT_VIEW")),
      series: showSeries ? seriesOf((d) => viewsDay.get(d) ?? 0) : undefined,
      kind: "count",
    },
    {
      key: "cartAdds",
      label: "Added to cart",
      value: countBy(curEvents, "CART_ADD"),
      prev: countBy(prevEvents, "CART_ADD"),
      deltaPct: delta(countBy(curEvents, "CART_ADD"), countBy(prevEvents, "CART_ADD")),
      series: showSeries ? seriesOf((d) => cartsDay.get(d) ?? 0) : undefined,
      kind: "count",
    },
    {
      key: "checkoutStarts",
      label: "Checkout started",
      value: countBy(curEvents, "CHECKOUT_START"),
      prev: countBy(prevEvents, "CHECKOUT_START"),
      deltaPct: delta(countBy(curEvents, "CHECKOUT_START"), countBy(prevEvents, "CHECKOUT_START")),
      series: showSeries ? seriesOf((d) => checkoutsDay.get(d) ?? 0) : undefined,
      kind: "count",
      note: hasCheckoutData ? undefined : "Tracking just enabled",
    },
    {
      key: "orders",
      label: "Orders",
      value: curOrders.length,
      prev: prevOrders.length,
      deltaPct: delta(curOrders.length, prevOrders.length),
      series: showSeries ? seriesOf((d) => ordersByDay.get(d)?.n ?? 0) : undefined,
      kind: "count",
    },
    {
      key: "revenue",
      label: "Revenue",
      value: revenueCur,
      prev: revenuePrev,
      deltaPct: delta(revenueCur, revenuePrev),
      series: showSeries ? seriesOf((d) => ordersByDay.get(d)?.rev ?? 0) : undefined,
      kind: "money",
    },
    { key: "aov", label: "Avg. order value", value: aovCur, prev: aovPrev, deltaPct: delta(aovCur, aovPrev), kind: "money" },
    {
      key: "conversion",
      label: "Conversion rate",
      value: convCur,
      prev: convPrev,
      deltaPct: delta(convCur, convPrev),
      kind: "pct",
      note: "Buyers ÷ visitors",
    },
    {
      key: "abandonment",
      label: "Cart abandonment",
      value: abandonCur,
      prev: abandonPrev,
      deltaPct: delta(abandonCur, abandonPrev),
      kind: "pct",
      note: "Cart adders who didn't order",
    },
    {
      key: "bounce",
      label: "Bounce rate",
      value: bounceCur,
      prev: bouncePrev,
      deltaPct: delta(bounceCur, bouncePrev),
      kind: "pct",
      note: "Single-interaction visitors (approx.)",
    },
    { key: "newCustomers", label: "New customers", value: newCustomers, prev: 0, deltaPct: null, kind: "count", note: "First-ever order in this period" },
    { key: "repeatCustomers", label: "Repeat customers", value: Math.max(0, repeatCustomers), prev: 0, deltaPct: null, kind: "count", note: "Ordered before this period too" },
  ];

  // --- Top products (range-scoped) ---
  const viewByProduct = new Map<string, number>();
  const cartByProduct = new Map<string, number>();
  for (const e of curEvents) {
    if (!e.productId) continue;
    if (e.type === "PRODUCT_VIEW") viewByProduct.set(e.productId, (viewByProduct.get(e.productId) ?? 0) + 1);
    if (e.type === "CART_ADD") cartByProduct.set(e.productId, (cartByProduct.get(e.productId) ?? 0) + 1);
  }
  const soldByProduct = new Map<string, { name: string; units: number; revenue: number }>();
  for (const it of orderItems) {
    const id = it.productId ?? `snap:${it.productName}`;
    const b = soldByProduct.get(id) ?? { name: it.productName, units: 0, revenue: 0 };
    b.units += it.quantity;
    b.revenue += it.price * it.quantity;
    soldByProduct.set(id, b);
  }

  // Resolve names for event-derived product ids.
  const eventIds = [...new Set([...viewByProduct.keys(), ...cartByProduct.keys()])];
  const nameMap = new Map<string, string>();
  for (const [id, b] of soldByProduct) nameMap.set(id, b.name);
  const unresolved = eventIds.filter((id) => !nameMap.has(id));
  if (unresolved.length) {
    const prods = await prisma.product.findMany({
      where: { id: { in: unresolved } },
      select: { id: true, name: true },
    });
    for (const p of prods) nameMap.set(p.id, p.name);
  }
  const nameOf = (id: string) => nameMap.get(id) ?? "Product";

  const top = (m: Map<string, number>, sub: string): RankRow[] =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([id, v]) => ({ id, name: nameOf(id), value: v, sub }));

  const mostViewed = top(viewByProduct, "views");
  const mostCartAdded = top(cartByProduct, "cart adds");
  const mostPurchased = [...soldByProduct.entries()]
    .sort((a, b) => b[1].units - a[1].units)
    .slice(0, 5)
    .map(([id, b]) => ({ id, name: b.name, value: b.units, sub: "units" }));
  const highestRevenue = [...soldByProduct.entries()]
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([id, b]) => ({ id, name: b.name, value: b.revenue, sub: `${b.units} units` }));
  const lowestConversion: RankRow[] = [...viewByProduct.entries()]
    .map(([id, views]) => ({ id, views, sold: soldByProduct.get(id)?.units ?? 0 }))
    .filter((x) => x.views >= 10)
    .map((x) => ({ ...x, rate: x.sold / x.views }))
    .sort((a, b) => a.rate - b.rate)
    .slice(0, 5)
    .map((x) => ({ id: x.id, name: nameOf(x.id), value: x.views, sub: `${x.views} views · ${x.sold} sold` }));

  // --- Geo (from the order's address snapshot) ---
  const cityAgg = new Map<string, { orders: number; revenue: number }>();
  const stateAgg = new Map<string, { orders: number; revenue: number }>();
  for (const o of curOrders) {
    const addr = o.shippingAddress as { city?: string; state?: string } | null;
    const city = addr?.city ? titleCase(addr.city) : null;
    const state = addr?.state ? titleCase(addr.state) : null;
    if (city) {
      const b = cityAgg.get(city) ?? { orders: 0, revenue: 0 };
      b.orders++;
      b.revenue += o.total;
      cityAgg.set(city, b);
    }
    if (state) {
      const b = stateAgg.get(state) ?? { orders: 0, revenue: 0 };
      b.orders++;
      b.revenue += o.total;
      stateAgg.set(state, b);
    }
  }
  const geoTop = (m: Map<string, { orders: number; revenue: number }>): RankRow[] =>
    [...m.entries()]
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .slice(0, 6)
      .map(([name, b]) => ({ id: name, name, value: b.revenue, sub: `${b.orders} order${b.orders === 1 ? "" : "s"}` }));

  // --- Devices (distinct identities per device) & traffic sources ---
  const deviceIds = new Map<string, Set<string>>();
  for (const e of curEvents) {
    if (!e.device) continue;
    const id = identity(e);
    if (!id) continue;
    if (!deviceIds.has(e.device)) deviceIds.set(e.device, new Set());
    deviceIds.get(e.device)!.add(id);
  }
  const devices: RankRow[] = [...deviceIds.entries()]
    .sort((a, b) => b[1].size - a[1].size)
    .map(([name, s]) => ({ id: name, name: titleCase(name), value: s.size, sub: "visitors" }));

  const sourceAgg = new Map<string, number>();
  for (const e of curEvents) {
    if (e.type !== "PAGE_VIEW") continue;
    const src = classifySource(e.referrer);
    sourceAgg.set(src, (sourceAgg.get(src) ?? 0) + 1);
  }
  const sources: RankRow[] = [...sourceAgg.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, v]) => ({ id: name, name, value: v, sub: "visits" }));

  // --- Cart recovery (abandoned-cart automation → later order) ---
  const ordersByUser = new Map<string, { createdAt: Date; total: number }[]>();
  for (const o of curOrders) {
    if (!o.userId) continue;
    if (!ordersByUser.has(o.userId)) ordersByUser.set(o.userId, []);
    ordersByUser.get(o.userId)!.push({ createdAt: o.createdAt, total: o.total });
  }
  let recoveredCarts = 0;
  let recoveredRevenue = 0;
  const recoveredUsers = new Set<string>();
  for (const log of abandonLogs) {
    if (!log.userId || recoveredUsers.has(log.userId)) continue;
    const after = (ordersByUser.get(log.userId) ?? [])
      .filter((o) => o.createdAt > log.createdAt)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())[0];
    if (after) {
      recoveredUsers.add(log.userId);
      recoveredCarts++;
      recoveredRevenue += after.total;
    }
  }

  return {
    range: { key: r.key, fromISO: r.from.toISOString(), toISO: r.to.toISOString(), days: r.days, label: r.label },
    funnel,
    kpis,
    topProducts: { mostViewed, mostCartAdded, mostPurchased, highestRevenue, lowestConversion },
    geo: { cities: geoTop(cityAgg), states: geoTop(stateAgg) },
    devices,
    sources,
    recovery: { logs: abandonLogs.length, recoveredCarts, recoveredRevenue },
    flags: { hasVisitorData, hasCheckoutData, hasDeviceData, hasSourceData },
  };
}
