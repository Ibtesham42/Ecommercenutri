import "server-only";
import { prisma } from "@/lib/prisma";
import type { Competitor, CompetitorSignal, ContentIdea, IntelligenceReport } from "@prisma/client";
import { aiAvailable } from "@/lib/ai/provider";
import { getIntelligenceSettings, type IntelligenceSettings } from "@/lib/intelligence/settings";
import { istWeekKey, istMonthKey, istDateKey } from "@/lib/intelligence/engine";
import type { CompetitorProfileData, ContentGapsData, MarketTrendsData } from "@/lib/intelligence/types";

/** Read models for the Competitor Intelligence dashboard (RSC pages only). */

export type CompetitorRow = Competitor & {
  signalCount: number;
  profileSummary: string | null;
  profile: CompetitorProfileData | null;
  avgEngagement: number | null;
};

export type HeatmapCell = { topic: string; week: string; count: number };

export type IntelligenceOverview = {
  settings: IntelligenceSettings;
  aiConfigured: boolean;
  competitors: CompetitorRow[];
  weekly: { summary: string; data: MarketTrendsData; generatedAt: Date } | null;
  monthly: { summary: string; data: MarketTrendsData; generatedAt: Date } | null;
  gaps: { summary: string; data: ContentGapsData; generatedAt: Date } | null;
  todaysIdeas: ContentIdea[];
  ideaBatchDate: string | null; // batch shown (today's, or the latest)
  heatmap: { topics: string[]; weeks: string[]; cells: HeatmapCell[] };
  ourAvgEngagement: number | null; // avg likes+comments on our published posts
};

function avg(nums: number[]): number | null {
  return nums.length ? Math.round(nums.reduce((a, b) => a + b, 0) / nums.length) : null;
}

/** Roll signal topics into a topic × ISO-week frequency grid (last 8 weeks). */
function buildHeatmap(
  signals: Pick<CompetitorSignal, "topics" | "createdAt" | "postedAt">[],
  now: Date,
): IntelligenceOverview["heatmap"] {
  const weeks: string[] = [];
  for (let i = 7; i >= 0; i--) {
    weeks.push(istWeekKey(new Date(now.getTime() - i * 7 * 24 * 3600 * 1000)));
  }
  const weekSet = new Set(weeks);
  const counts = new Map<string, Map<string, number>>(); // topic -> week -> n
  const totals = new Map<string, number>();
  for (const s of signals) {
    const week = istWeekKey(s.postedAt ?? s.createdAt);
    if (!weekSet.has(week)) continue;
    for (const raw of s.topics) {
      const topic = raw.trim().toLowerCase();
      if (!topic) continue;
      const perWeek = counts.get(topic) ?? new Map<string, number>();
      perWeek.set(week, (perWeek.get(week) ?? 0) + 1);
      counts.set(topic, perWeek);
      totals.set(topic, (totals.get(topic) ?? 0) + 1);
    }
  }
  const topics = [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([t]) => t);
  const cells: HeatmapCell[] = [];
  for (const topic of topics) {
    for (const week of weeks) {
      cells.push({ topic, week, count: counts.get(topic)?.get(week) ?? 0 });
    }
  }
  return { topics, weeks, cells };
}

export async function getIntelligenceOverview(): Promise<IntelligenceOverview> {
  const now = new Date();
  const settings = await getIntelligenceSettings();
  const empty: IntelligenceOverview = {
    settings,
    aiConfigured: aiAvailable(),
    competitors: [],
    weekly: null,
    monthly: null,
    gaps: null,
    todaysIdeas: [],
    ideaBatchDate: null,
    heatmap: { topics: [], weeks: [], cells: [] },
    ourAvgEngagement: null,
  };
  try {
    const since = new Date(now.getTime() - 60 * 24 * 3600 * 1000);
    const [competitors, profiles, weekly, monthly, gaps, signals, ourPosts] = await Promise.all([
      prisma.competitor.findMany({
        orderBy: [{ priority: "asc" }, { name: "asc" }],
        include: { _count: { select: { signals: true } } },
      }),
      prisma.intelligenceReport.findMany({ where: { kind: "COMPETITOR_PROFILE" } }),
      prisma.intelligenceReport.findFirst({
        where: { kind: "MARKET_TRENDS", periodKey: istWeekKey(now) },
      }) as Promise<IntelligenceReport | null>,
      prisma.intelligenceReport.findFirst({
        where: { kind: "MARKET_TRENDS", periodKey: istMonthKey(now) },
      }),
      prisma.intelligenceReport.findFirst({
        where: { kind: "CONTENT_GAPS" },
        orderBy: { generatedAt: "desc" },
      }),
      prisma.competitorSignal.findMany({
        where: { createdAt: { gte: since } },
        select: { topics: true, createdAt: true, postedAt: true, likes: true, comments: true, competitorId: true },
      }),
      prisma.socialPost.findMany({
        where: { status: "PUBLISHED", likes: { not: null } },
        orderBy: { publishedAt: "desc" },
        take: 30,
        select: { likes: true, comments: true },
      }),
    ]);

    // Latest ideas: prefer today's batch, else the most recent one.
    const todayKey = istDateKey(now);
    let ideaBatchDate: string | null = todayKey;
    let todaysIdeas = await prisma.contentIdea.findMany({
      where: { batchDate: todayKey },
      orderBy: { totalScore: "desc" },
    });
    if (!todaysIdeas.length) {
      const latest = await prisma.contentIdea.findFirst({ orderBy: { createdAt: "desc" } });
      if (latest) {
        ideaBatchDate = latest.batchDate;
        todaysIdeas = await prisma.contentIdea.findMany({
          where: { batchDate: latest.batchDate },
          orderBy: { totalScore: "desc" },
        });
      } else {
        ideaBatchDate = null;
      }
    }

    const profileByCompetitor = new Map(profiles.map((p) => [p.competitorId ?? "", p]));
    const engByCompetitor = new Map<string, number[]>();
    for (const s of signals) {
      if (s.likes == null && s.comments == null) continue;
      const list = engByCompetitor.get(s.competitorId) ?? [];
      list.push((s.likes ?? 0) + (s.comments ?? 0));
      engByCompetitor.set(s.competitorId, list);
    }

    const rows: CompetitorRow[] = competitors.map((c) => {
      const report = profileByCompetitor.get(c.id);
      return {
        ...c,
        signalCount: c._count.signals,
        profileSummary: report?.summary ?? null,
        profile: (report?.data as CompetitorProfileData | undefined) ?? null,
        avgEngagement: avg(engByCompetitor.get(c.id) ?? []),
      };
    });

    return {
      settings,
      aiConfigured: aiAvailable(),
      competitors: rows,
      weekly: weekly
        ? { summary: weekly.summary, data: weekly.data as MarketTrendsData, generatedAt: weekly.generatedAt }
        : null,
      monthly: monthly
        ? { summary: monthly.summary, data: monthly.data as MarketTrendsData, generatedAt: monthly.generatedAt }
        : null,
      gaps: gaps
        ? { summary: gaps.summary, data: gaps.data as ContentGapsData, generatedAt: gaps.generatedAt }
        : null,
      todaysIdeas,
      ideaBatchDate,
      heatmap: buildHeatmap(signals, now),
      ourAvgEngagement: avg(ourPosts.map((p) => (p.likes ?? 0) + (p.comments ?? 0))),
    };
  } catch (e) {
    console.error("[intelligence] overview failed:", e);
    return empty;
  }
}

export type CompetitorDetail = Competitor & {
  signals: CompetitorSignal[];
  profileSummary: string | null;
  profile: CompetitorProfileData | null;
};

export async function getCompetitorsDetailed(): Promise<CompetitorDetail[]> {
  try {
    const [competitors, profiles] = await Promise.all([
      prisma.competitor.findMany({
        orderBy: [{ priority: "asc" }, { name: "asc" }],
        include: { signals: { orderBy: { createdAt: "desc" }, take: 12 } },
      }),
      prisma.intelligenceReport.findMany({ where: { kind: "COMPETITOR_PROFILE" } }),
    ]);
    const byId = new Map(profiles.map((p) => [p.competitorId ?? "", p]));
    return competitors.map((c) => ({
      ...c,
      profileSummary: byId.get(c.id)?.summary ?? null,
      profile: (byId.get(c.id)?.data as CompetitorProfileData | undefined) ?? null,
    }));
  } catch (e) {
    console.error("[intelligence] competitors failed:", e);
    return [];
  }
}

export async function getContentIdeas(limit = 100): Promise<ContentIdea[]> {
  try {
    return await prisma.contentIdea.findMany({
      orderBy: [{ createdAt: "desc" }, { totalScore: "desc" }],
      take: limit,
    });
  } catch {
    return [];
  }
}
