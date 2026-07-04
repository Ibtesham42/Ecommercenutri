import "server-only";
import { prisma } from "@/lib/prisma";
import { cached } from "@/lib/redis";
import { resolveRange, type RangeInput } from "@/lib/queries/analytics";
import { HEAT_SECTIONS, PAGE_SECTION, PAGE_GROUP_LABELS, heatSectionLabel } from "@/lib/heat-sections";

/**
 * Website Heatmap + Rage-click + Session-replay reads for /admin/insights.
 * Heat data comes pre-aggregated (HeatStat daily counters), so these queries
 * are cheap at any traffic level. Everything degrades to empty structures
 * before any data exists.
 */

// ---------- Heatmap ----------

export type HeatSection = {
  key: string;
  label: string;
  views: number;
  clicks: number;
  clickRate: number; // %
  hovers: number; // desktop hover-dwells
  taps: number; // mobile/tablet clicks
  avgTimeMs: number; // avg visible time per impression
  score: number; // engagement score 0-100
};

export type HeatPage = {
  page: string;
  label: string;
  visits: number;
  avgTimeMs: number;
  scroll25: number; // % of visits reaching each depth
  scroll50: number;
  scroll75: number;
  scroll100: number;
};

export type HeatmapAnalytics = {
  rangeLabel: string;
  sections: HeatSection[]; // sorted by score desc
  pages: HeatPage[]; // sorted by visits desc
  hasData: boolean;
};

export async function getHeatmapAnalytics(input: RangeInput): Promise<HeatmapAnalytics> {
  const r = resolveRange(input);
  const key = `heatmap:v1:${r.from.toISOString().slice(0, 10)}:${r.to.toISOString().slice(0, 10)}`;
  try {
    return await cached(key, 120, async () => {
      const rows = await prisma.heatStat.findMany({
        where: { day: { gte: r.from, lt: r.to } },
        take: 20_000,
      });

      type Agg = { views: number; clicks: number; hovers: number; taps: number; timeMs: number };
      const bySection = new Map<string, Agg>();
      type PageAgg = {
        visits: number;
        timeMs: number;
        s25: number;
        s50: number;
        s75: number;
        s100: number;
      };
      const byPage = new Map<string, PageAgg>();

      for (const row of rows) {
        if (row.section === PAGE_SECTION) {
          const p = byPage.get(row.page) ?? { visits: 0, timeMs: 0, s25: 0, s50: 0, s75: 0, s100: 0 };
          p.visits += row.views;
          p.timeMs += row.timeMs;
          p.s25 += row.scroll25;
          p.s50 += row.scroll50;
          p.s75 += row.scroll75;
          p.s100 += row.scroll100;
          byPage.set(row.page, p);
        } else {
          const a = bySection.get(row.section) ?? { views: 0, clicks: 0, hovers: 0, taps: 0, timeMs: 0 };
          a.views += row.views;
          a.clicks += row.clicks;
          a.hovers += row.hovers;
          if (row.device !== "desktop") a.taps += row.clicks;
          a.timeMs += row.timeMs;
          bySection.set(row.section, a);
        }
      }

      // Raw per-section signals → 0-100 engagement score. Each component is
      // normalized against the best section in the period, so the score is
      // relative ("how does this section compare to your best-performing one").
      const pre = [...bySection.entries()].map(([k, a]) => ({
        key: k,
        ...a,
        clickRate: a.views > 0 ? (a.clicks / a.views) * 100 : 0,
        avgTimeMs: a.views > 0 ? a.timeMs / a.views : 0,
        interactRate: a.views > 0 ? ((a.clicks + a.hovers) / a.views) * 100 : 0,
      }));
      const maxClickRate = Math.max(1e-6, ...pre.map((s) => s.clickRate));
      const maxTime = Math.max(1e-6, ...pre.map((s) => s.avgTimeMs));
      const maxInteract = Math.max(1e-6, ...pre.map((s) => s.interactRate));

      const sections: HeatSection[] = pre
        .map((s) => ({
          key: s.key,
          label: heatSectionLabel(s.key),
          views: s.views,
          clicks: s.clicks,
          clickRate: s.clickRate,
          hovers: s.hovers,
          taps: s.taps,
          avgTimeMs: Math.round(s.avgTimeMs),
          score:
            s.views === 0
              ? 0
              : Math.round(
                  100 *
                    (0.45 * (s.clickRate / maxClickRate) +
                      0.3 * (s.avgTimeMs / maxTime) +
                      0.25 * (s.interactRate / maxInteract)),
                ),
        }))
        .sort((a, b) => b.score - a.score);

      // Sections that exist in the registry but saw no data yet still show
      // (score 0) so the admin sees full coverage.
      const seen = new Set(sections.map((s) => s.key));
      for (const k of Object.keys(HEAT_SECTIONS)) {
        if (!seen.has(k)) {
          sections.push({
            key: k,
            label: heatSectionLabel(k),
            views: 0,
            clicks: 0,
            clickRate: 0,
            hovers: 0,
            taps: 0,
            avgTimeMs: 0,
            score: 0,
          });
        }
      }

      const pages: HeatPage[] = [...byPage.entries()]
        .map(([page, p]) => ({
          page,
          label: PAGE_GROUP_LABELS[page] ?? page,
          visits: p.visits,
          avgTimeMs: p.visits > 0 ? Math.round(p.timeMs / p.visits) : 0,
          scroll25: p.visits > 0 ? Math.min(100, (p.s25 / p.visits) * 100) : 0,
          scroll50: p.visits > 0 ? Math.min(100, (p.s50 / p.visits) * 100) : 0,
          scroll75: p.visits > 0 ? Math.min(100, (p.s75 / p.visits) * 100) : 0,
          scroll100: p.visits > 0 ? Math.min(100, (p.s100 / p.visits) * 100) : 0,
        }))
        .sort((a, b) => b.visits - a.visits);

      return {
        rangeLabel: r.label,
        sections,
        pages,
        hasData: rows.length > 0,
      };
    });
  } catch (err) {
    console.error("[heatmap] query failed:", err);
    return { rangeLabel: r.label, sections: [], pages: [], hasData: false };
  }
}

// ---------- Rage clicks ----------

export type RageIssue = {
  element: string; // data-heat key or element descriptor
  label: string;
  path: string;
  count: number;
  sessions: number;
  prevCount: number;
  deltaPct: number | null;
};

export async function getRageClicks(input: RangeInput): Promise<{ issues: RageIssue[]; total: number }> {
  const r = resolveRange(input);
  try {
    const rows = await prisma.userEvent.findMany({
      where: { type: "RAGE_CLICK", createdAt: { gte: r.prevFrom, lt: r.to } },
      select: { source: true, path: true, userId: true, anonId: true, createdAt: true },
      take: 10_000,
    });
    const cur = rows.filter((e) => e.createdAt >= r.from);
    const prev = rows.filter((e) => e.createdAt < r.from);

    type Agg = { count: number; ids: Set<string> };
    const group = (list: typeof rows) => {
      const m = new Map<string, Agg>();
      for (const e of list) {
        const k = `${e.source ?? "unknown"}|${e.path ?? ""}`;
        const a = m.get(k) ?? { count: 0, ids: new Set<string>() };
        a.count++;
        const id = e.userId ?? e.anonId;
        if (id) a.ids.add(id);
        m.set(k, a);
      }
      return m;
    };
    const curMap = group(cur);
    const prevMap = group(prev);

    const issues: RageIssue[] = [...curMap.entries()]
      .map(([k, a]) => {
        const [element, path] = k.split("|");
        const prevCount = prevMap.get(k)?.count ?? 0;
        return {
          element,
          label: element in HEAT_SECTIONS ? heatSectionLabel(element) : element,
          path: path || "?",
          count: a.count,
          sessions: a.ids.size,
          prevCount,
          deltaPct:
            a.count === 0 && prevCount === 0
              ? null
              : prevCount === 0
                ? 100
                : ((a.count - prevCount) / prevCount) * 100,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    return { issues, total: cur.length };
  } catch (err) {
    console.error("[rage] query failed:", err);
    return { issues: [], total: 0 };
  }
}

// ---------- Session replay ----------

const REPLAY_RETENTION_DAYS = 30;
const REPLAY_MAX_ROWS = 800;

export type ReplaySummary = {
  id: string;
  startedAt: string;
  duration: number;
  pageCount: number;
  clickCount: number;
  rageCount: number;
  reachedCheckout: boolean;
  purchased: boolean;
  device: string | null;
  signedIn: boolean;
};

/** Recent recordings (retention-pruned lazily on read; newest first). */
export async function getSessionReplays(limit = 40): Promise<ReplaySummary[]> {
  try {
    // Lazy retention: recordings expire after 30 days; cap total rows.
    const cutoff = new Date(Date.now() - REPLAY_RETENTION_DAYS * 86_400_000);
    await prisma.sessionRecording.deleteMany({ where: { startedAt: { lt: cutoff } } });
    const total = await prisma.sessionRecording.count();
    if (total > REPLAY_MAX_ROWS) {
      const overflow = await prisma.sessionRecording.findMany({
        orderBy: { startedAt: "asc" },
        take: total - REPLAY_MAX_ROWS,
        select: { id: true },
      });
      await prisma.sessionRecording.deleteMany({
        where: { id: { in: overflow.map((o) => o.id) } },
      });
    }

    const rows = await prisma.sessionRecording.findMany({
      orderBy: { startedAt: "desc" },
      take: limit,
      select: {
        id: true,
        startedAt: true,
        duration: true,
        pageCount: true,
        clickCount: true,
        rageCount: true,
        reachedCheckout: true,
        purchased: true,
        device: true,
        userId: true,
      },
    });
    return rows.map((row) => ({
      id: row.id,
      startedAt: row.startedAt.toISOString(),
      duration: row.duration,
      pageCount: row.pageCount,
      clickCount: row.clickCount,
      rageCount: row.rageCount,
      reachedCheckout: row.reachedCheckout,
      purchased: row.purchased,
      device: row.device,
      signedIn: !!row.userId,
    }));
  } catch (err) {
    console.error("[replay] list failed:", err);
    return [];
  }
}

export type ReplayPage = {
  path: string;
  t: number;
  w: number;
  h: number;
  dur: number;
  ev: [number, number, number, number?][];
};

export type ReplayDetail = ReplaySummary & { pages: ReplayPage[] };

export async function getSessionReplay(id: string): Promise<ReplayDetail | null> {
  try {
    const row = await prisma.sessionRecording.findUnique({ where: { id } });
    if (!row) return null;
    return {
      id: row.id,
      startedAt: row.startedAt.toISOString(),
      duration: row.duration,
      pageCount: row.pageCount,
      clickCount: row.clickCount,
      rageCount: row.rageCount,
      reachedCheckout: row.reachedCheckout,
      purchased: row.purchased,
      device: row.device,
      signedIn: !!row.userId,
      pages: (row.pages as unknown as ReplayPage[]) ?? [],
    };
  } catch (err) {
    console.error("[replay] detail failed:", err);
    return null;
  }
}
