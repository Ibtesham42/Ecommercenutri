import "server-only";
import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/redis";
import {
  resolveRange,
  classifySource,
  type RangeInput,
  type ResolvedRange,
} from "@/lib/queries/analytics";
import { CONFIDENCE } from "@/lib/analytics-confidence";

/**
 * Customer Journey Analytics — the full shopper funnel from first visit to
 * returning customer, scoped to the admin's date range and filterable by
 * device / traffic source / product / state / city. Additive companion to
 * lib/queries/analytics.ts (whose 6-stage funnel and KPI sections are
 * untouched). One bounded UserEvent fetch; everything else is computed in
 * memory per "session" (unique shopper identity within the window, matching
 * how the existing funnel counts people rather than page loads).
 */

export type JourneyFilters = {
  device?: string;
  source?: string;
  product?: string;
  state?: string;
  city?: string;
};

export type JourneyInput = RangeInput & JourneyFilters;

export type JourneyStageKey =
  | "visitors"
  | "landing"
  | "home"
  | "category"
  | "product"
  | "search"
  | "cartAdd"
  | "checkoutStart"
  | "payment"
  | "orderSuccess"
  | "returning";

export type JourneyStage = {
  key: JourneyStageKey;
  label: string;
  users: number;
  convPct: number | null; // vs previous stage
  dropPct: number | null;
  exitPct: number | null; // reached this stage and went no further
  avgTimeMs: number | null; // avg time from this stage to the next (converters)
  deltaPct: number | null; // users vs previous period
  pending?: boolean; // tracking for this stage just enabled
  optional?: boolean; // browse stages shoppers may legitimately skip
};

export type JourneyAnalytics = {
  range: { key: string; fromISO: string; toISO: string; days: number; label: string };
  stages: JourneyStage[];
  applied: JourneyFilters;
  filtered: boolean;
  totalSessions: number;
  confidence: { ok: boolean; sessions: number; min: number };
  options: {
    sources: string[];
    states: string[];
    cities: string[];
    products: { id: string; name: string }[];
  };
};

// Ordered funnel; "optional" stages are browse paths a shopper can skip, so
// exit rate treats any later stage as continuation.
const STAGES: { key: JourneyStageKey; label: string; optional?: boolean }[] = [
  { key: "visitors", label: "Visitor" },
  { key: "landing", label: "Landing page" },
  { key: "home", label: "Homepage" },
  { key: "category", label: "Category", optional: true },
  { key: "product", label: "Product" },
  { key: "search", label: "Search", optional: true },
  { key: "cartAdd", label: "Add to cart" },
  { key: "checkoutStart", label: "Checkout started" },
  { key: "payment", label: "Payment" },
  { key: "orderSuccess", label: "Order success" },
  { key: "returning", label: "Returning customer" },
];

const STAGE_OF_TYPE: Partial<Record<string, JourneyStageKey>> = {
  PAGE_VIEW: "landing",
  HOME_VIEW: "home",
  CATEGORY_VIEW: "category",
  PRODUCT_VIEW: "product",
  SEARCH: "search",
  CART_ADD: "cartAdd",
  CHECKOUT_START: "checkoutStart",
  PAYMENT_START: "payment",
  PURCHASE: "orderSuccess",
};

type EventRow = {
  type: string;
  userId: string | null;
  anonId: string | null;
  productId: string | null;
  device: string | null;
  referrer: string | null;
  city: string | null;
  region: string | null;
  createdAt: Date;
};

type Session = {
  device: string | null;
  source: string | null;
  city: string | null;
  region: string | null;
  products: Set<string>;
  firstTouch: Map<JourneyStageKey, number>; // stage → first event time (ms)
  anyEvent: boolean;
};

function delta(cur: number, prev: number): number | null {
  if (cur === 0 && prev === 0) return null;
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

function buildSessions(rows: EventRow[]): Map<string, Session> {
  const sessions = new Map<string, Session>();
  for (const e of rows) {
    const id = e.userId ?? e.anonId;
    if (!id) continue;
    let s = sessions.get(id);
    if (!s) {
      s = {
        device: null,
        source: null,
        city: null,
        region: null,
        products: new Set(),
        firstTouch: new Map(),
        anyEvent: false,
      };
      sessions.set(id, s);
    }
    s.anyEvent = true;
    if (!s.device && e.device) s.device = e.device;
    if (!s.city && e.city) s.city = e.city;
    if (!s.region && e.region) s.region = e.region;
    if (!s.source && e.type === "PAGE_VIEW") s.source = classifySource(e.referrer);
    if (e.productId) s.products.add(e.productId);
    const stage = STAGE_OF_TYPE[e.type];
    if (stage) {
      const t = e.createdAt.getTime();
      const prev = s.firstTouch.get(stage);
      if (prev === undefined || t < prev) s.firstTouch.set(stage, t);
    }
  }
  return sessions;
}

function matches(s: Session, f: JourneyFilters): boolean {
  if (f.device && s.device !== f.device) return false;
  if (f.source && (s.source ?? "Direct") !== f.source) return false;
  if (f.product && !s.products.has(f.product)) return false;
  if (f.state && s.region !== f.state) return false;
  if (f.city && s.city !== f.city) return false;
  return true;
}

function emptyJourney(r: ResolvedRange, applied: JourneyFilters): JourneyAnalytics {
  return {
    range: { key: r.key, fromISO: r.from.toISOString(), toISO: r.to.toISOString(), days: r.days, label: r.label },
    stages: [],
    applied,
    filtered: Object.values(applied).some(Boolean),
    totalSessions: 0,
    confidence: { ok: false, sessions: 0, min: CONFIDENCE.minJourneySessions },
    options: { sources: [], states: [], cities: [], products: [] },
  };
}

export async function getJourneyAnalytics(input: JourneyInput): Promise<JourneyAnalytics> {
  const r = resolveRange(input);
  const applied: JourneyFilters = {
    device: input.device?.slice(0, 20) || undefined,
    source: input.source?.slice(0, 40) || undefined,
    product: input.product?.slice(0, 40) || undefined,
    state: input.state?.slice(0, 60) || undefined,
    city: input.city?.slice(0, 60) || undefined,
  };
  const cacheKey = `journey:v1:${r.key}:${r.from.toISOString().slice(0, 10)}:${r.to
    .toISOString()
    .slice(0, 10)}:${JSON.stringify(applied)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await cached(cacheKey, 120, () => computeJourney(r, applied));
    } catch (err) {
      console.error(`[journey] compute failed (attempt ${attempt + 1}/2):`, err);
      if (attempt === 0) await new Promise((res) => setTimeout(res, 400));
    }
  }
  return emptyJourney(r, applied);
}

async function computeJourney(r: ResolvedRange, applied: JourneyFilters): Promise<JourneyAnalytics> {
  const events = (await prisma.userEvent.findMany({
    where: { createdAt: { gte: r.prevFrom, lt: r.to } },
    select: {
      type: true,
      userId: true,
      anonId: true,
      productId: true,
      device: true,
      referrer: true,
      city: true,
      region: true,
      createdAt: true,
    },
    take: 50_000,
  })) as EventRow[];

  const curRows = events.filter((e) => e.createdAt >= r.from);
  const prevRows = events.filter((e) => e.createdAt < r.from);
  const allCur = buildSessions(curRows);
  const allPrev = buildSessions(prevRows);

  // Returning customer = active now AND seen before this period (events in the
  // previous window, or an order placed before the range started).
  const curUserIds = [...allCur.keys()];
  const priorBuyers = curUserIds.length
    ? await prisma.order.groupBy({
        by: ["userId"],
        where: {
          userId: { in: curUserIds.slice(0, 5_000) },
          createdAt: { lt: r.from },
        },
        _count: { _all: true },
      })
    : [];
  const priorBuyerIds = new Set(priorBuyers.map((g) => g.userId).filter(Boolean) as string[]);
  for (const [id, s] of allCur) {
    if (allPrev.has(id) || priorBuyerIds.has(id)) {
      // Stamp "returning" at their latest stage touch so timing stays sane.
      const t = Math.max(...s.firstTouch.values(), r.from.getTime());
      s.firstTouch.set("returning", t);
    }
  }

  // Filter options come from the UNFILTERED current window (so the selects
  // always show what's available), before applying the admin's filters.
  const sources = new Set<string>();
  const states = new Map<string, number>();
  const cities = new Map<string, number>();
  const productHits = new Map<string, number>();
  for (const s of allCur.values()) {
    if (s.source) sources.add(s.source);
    if (s.region) states.set(s.region, (states.get(s.region) ?? 0) + 1);
    if (s.city) cities.set(s.city, (cities.get(s.city) ?? 0) + 1);
    for (const p of s.products) productHits.set(p, (productHits.get(p) ?? 0) + 1);
  }
  const topN = (m: Map<string, number>, n: number) =>
    [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  const topProductIds = topN(productHits, 30);
  const productRows = topProductIds.length
    ? await prisma.product.findMany({
        where: { id: { in: topProductIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameOf = new Map(productRows.map((p) => [p.id, p.name]));

  const cur = [...allCur.values()].filter((s) => matches(s, applied));
  const prev = [...allPrev.values()].filter((s) => matches(s, applied));

  const reached = (list: Session[], key: JourneyStageKey) =>
    key === "visitors" ? list.filter((s) => s.anyEvent) : list.filter((s) => s.firstTouch.has(key));

  // "visitors" is a synthetic stage: stamp its first touch as the earliest one.
  const firstOf = (s: Session, key: JourneyStageKey): number | undefined => {
    if (key !== "visitors") return s.firstTouch.get(key);
    let min: number | undefined;
    for (const t of s.firstTouch.values()) if (min === undefined || t < min) min = t;
    return min;
  };

  const stageIndex = new Map(STAGES.map((st, i) => [st.key, i]));
  const hasPaymentData = events.some((e) => e.type === "PAYMENT_START");
  const hasHomeData = events.some((e) => e.type === "HOME_VIEW");

  const stages: JourneyStage[] = STAGES.map((st, i) => {
    const curReached = reached(cur, st.key);
    const prevReached = reached(prev, st.key).length;
    const users = curReached.length;

    // Previous NON-OPTIONAL stage is the conversion base, so skippable browse
    // stages (category/search) don't distort the main path.
    let baseIdx = i - 1;
    while (baseIdx > 0 && STAGES[baseIdx].optional) baseIdx--;
    const base = i > 0 ? reached(cur, STAGES[baseIdx].key).length : 0;
    const pending =
      (st.key === "payment" && !hasPaymentData) || (st.key === "home" && !hasHomeData);
    const convPct = i > 0 && base > 0 && !pending ? (users / base) * 100 : null;

    // Exit rate: reached this stage but nothing later in the funnel.
    let exits = 0;
    for (const s of curReached) {
      let hasLater = false;
      for (const [k] of s.firstTouch) {
        const idx = stageIndex.get(k);
        if (idx !== undefined && idx > i) {
          hasLater = true;
          break;
        }
      }
      if (!hasLater) exits++;
    }

    // Average time from this stage's first touch to the NEXT reached stage.
    let timeSum = 0;
    let timeN = 0;
    for (const s of curReached) {
      const t0 = firstOf(s, st.key);
      if (t0 === undefined) continue;
      let next: number | undefined;
      for (const [k, t] of s.firstTouch) {
        const idx = stageIndex.get(k);
        if (idx !== undefined && idx > i && t >= t0 && (next === undefined || t < next)) next = t;
      }
      if (next !== undefined) {
        timeSum += next - t0;
        timeN++;
      }
    }

    return {
      key: st.key,
      label: st.label,
      users,
      convPct,
      dropPct: convPct === null ? null : Math.max(0, 100 - convPct),
      exitPct: users > 0 ? (exits / users) * 100 : null,
      avgTimeMs: timeN > 0 ? Math.round(timeSum / timeN) : null,
      deltaPct: pending ? null : delta(users, prevReached),
      pending: pending || undefined,
      optional: st.optional,
    };
  });

  return {
    range: { key: r.key, fromISO: r.from.toISOString(), toISO: r.to.toISOString(), days: r.days, label: r.label },
    stages,
    applied,
    filtered: Object.values(applied).some(Boolean),
    totalSessions: cur.length,
    confidence: {
      ok: cur.length >= CONFIDENCE.minJourneySessions,
      sessions: cur.length,
      min: CONFIDENCE.minJourneySessions,
    },
    options: {
      sources: [...sources].sort(),
      states: topN(states, 25),
      cities: topN(cities, 25),
      products: topProductIds.map((id) => ({ id, name: nameOf.get(id) ?? "Product" })),
    },
  };
}
