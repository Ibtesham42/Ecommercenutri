import "server-only";
import { prisma } from "@/lib/prisma";
import type { Competitor } from "@prisma/client";
import { getIntelligenceSettings } from "@/lib/intelligence/settings";
import { ensureDefaultCompetitors } from "@/lib/intelligence/competitors";
import { getSocialSettings } from "@/lib/social/settings";
import {
  analyzeCompetitorProfile,
  generateMarketTrends,
  generateContentGaps,
  generateContentIdeas,
  type SignalDigestEntry,
} from "@/lib/intelligence/ai";
import type { ContentGapsData, MarketTrendsData } from "@/lib/intelligence/types";

/**
 * The intelligence engine: turns the competitor watchlist + observed signals
 * into cached reports and a daily batch of scored, original content ideas.
 *
 * Everything is idempotent/cached so the every-30-min cron is cheap:
 * - competitor profiles refresh only when stale (settings.competitorRefreshDays)
 * - MARKET_TRENDS / CONTENT_GAPS are unique per (kind, periodKey) — one AI call
 *   per week/month, ever
 * - the ideas batch is keyed by IST date — one batch per morning
 */

const IST_OFFSET_MS = 330 * 60 * 1000;
const PROFILES_PER_RUN = 3; // bound cron duration
const SIGNAL_WINDOW_DAYS = 30;

// ── IST period keys ──────────────────────────────────────────────────────────

function istDate(now: Date): Date {
  return new Date(now.getTime() + IST_OFFSET_MS);
}

export function istDateKey(now: Date): string {
  return istDate(now).toISOString().slice(0, 10); // YYYY-MM-DD
}

export function istHour(now: Date): number {
  return istDate(now).getUTCHours();
}

export function istMonthKey(now: Date): string {
  return istDate(now).toISOString().slice(0, 7); // YYYY-MM
}

/** ISO-8601 week key, e.g. "2026-W28", computed on the IST calendar. */
export function istWeekKey(now: Date): string {
  const d = istDate(now);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = (target.getUTCDay() + 6) % 7; // Mon=0..Sun=6
  target.setUTCDate(target.getUTCDate() - dayNum + 3); // nearest Thursday
  const firstThursday = new Date(Date.UTC(target.getUTCFullYear(), 0, 4));
  const firstDayNum = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - firstDayNum + 3);
  const week = 1 + Math.round((target.getTime() - firstThursday.getTime()) / (7 * 24 * 3600 * 1000));
  return `${target.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function monthLabel(now: Date): string {
  const d = istDate(now);
  return `${MONTH_NAMES[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

// ── Signal digest ────────────────────────────────────────────────────────────

/** Roll the last 30 days of observed signals up per competitor for prompts. */
export async function buildSignalDigest(now: Date): Promise<SignalDigestEntry[]> {
  const since = new Date(now.getTime() - SIGNAL_WINDOW_DAYS * 24 * 3600 * 1000);
  const signals = await prisma.competitorSignal.findMany({
    where: { createdAt: { gte: since }, competitor: { active: true } },
    include: { competitor: { select: { name: true, category: true } } },
    orderBy: { createdAt: "desc" },
    take: 400,
  });
  const byCompetitor = new Map<string, typeof signals>();
  for (const s of signals) {
    const list = byCompetitor.get(s.competitor.name) ?? [];
    list.push(s);
    byCompetitor.set(s.competitor.name, list);
  }
  const digest: SignalDigestEntry[] = [];
  for (const [name, list] of byCompetitor) {
    const kinds = new Map<string, number>();
    const topics = new Set<string>();
    const hashtags = new Set<string>();
    let engSum = 0;
    let engN = 0;
    const observations: string[] = [];
    for (const s of list) {
      kinds.set(s.kind, (kinds.get(s.kind) ?? 0) + 1);
      s.topics.forEach((t) => topics.add(t));
      s.hashtags.forEach((h) => hashtags.add(h));
      if (s.likes != null || s.comments != null) {
        engSum += (s.likes ?? 0) + (s.comments ?? 0);
        engN++;
      }
      if (observations.length < 8) {
        observations.push(`${s.title}${s.summary ? ` — ${s.summary.slice(0, 160)}` : ""}`);
      }
    }
    digest.push({
      competitorName: name,
      category: list[0].competitor.category,
      count: list.length,
      kinds: [...kinds.entries()].map(([k, n]) => `${k} x${n}`),
      topics: [...topics].slice(0, 12),
      hashtags: [...hashtags].slice(0, 12),
      avgEngagement: engN ? Math.round(engSum / engN) : null,
      observations,
    });
  }
  return digest;
}

// ── Individual runners (also used by admin "Run now" actions) ────────────────

export async function runCompetitorProfile(competitor: Competitor): Promise<void> {
  const signals = await prisma.competitorSignal.findMany({
    where: { competitorId: competitor.id },
    orderBy: { createdAt: "desc" },
    take: 60,
  });
  const handles = [
    competitor.instagram ? `instagram: @${competitor.instagram}` : "",
    competitor.website ? `website: ${competitor.website}` : "",
    competitor.linkedin ? `linkedin: ${competitor.linkedin}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const result = await analyzeCompetitorProfile({
    name: competitor.name,
    category: competitor.category,
    handles,
    notes: competitor.notes,
    signals: signals.map((s) => ({
      kind: s.kind,
      source: s.source,
      title: s.title,
      summary: s.summary,
      postedAt: s.postedAt,
      likes: s.likes,
      comments: s.comments,
      hashtags: s.hashtags,
      topics: s.topics,
    })),
  });
  await prisma.$transaction([
    prisma.intelligenceReport.upsert({
      where: { kind_periodKey: { kind: "COMPETITOR_PROFILE", periodKey: competitor.id } },
      create: {
        kind: "COMPETITOR_PROFILE",
        competitorId: competitor.id,
        periodKey: competitor.id,
        summary: result.summary,
        data: result.data,
        model: result.model,
      },
      update: { summary: result.summary, data: result.data, model: result.model, generatedAt: new Date() },
    }),
    prisma.competitor.update({
      where: { id: competitor.id },
      data: { lastAnalyzedAt: new Date() },
    }),
  ]);
}

async function ensureTrendsReport(
  now: Date,
  periodKey: string,
  periodLabel: string,
  digest: SignalDigestEntry[],
  force = false,
): Promise<boolean> {
  if (!force) {
    const existing = await prisma.intelligenceReport.findUnique({
      where: { kind_periodKey: { kind: "MARKET_TRENDS", periodKey } },
      select: { id: true },
    });
    if (existing) return false;
  }
  const result = await generateMarketTrends({ periodLabel, digest });
  await prisma.intelligenceReport.upsert({
    where: { kind_periodKey: { kind: "MARKET_TRENDS", periodKey } },
    create: { kind: "MARKET_TRENDS", periodKey, summary: result.summary, data: result.data, model: result.model },
    update: { summary: result.summary, data: result.data, model: result.model, generatedAt: new Date() },
  });
  return true;
}

async function ensureGapsReport(
  now: Date,
  periodKey: string,
  periodLabel: string,
  digest: SignalDigestEntry[],
  force = false,
): Promise<boolean> {
  if (!force) {
    const existing = await prisma.intelligenceReport.findUnique({
      where: { kind_periodKey: { kind: "CONTENT_GAPS", periodKey } },
      select: { id: true },
    });
    if (existing) return false;
  }
  const trends = await prisma.intelligenceReport.findFirst({
    where: { kind: "MARKET_TRENDS" },
    orderBy: { generatedAt: "desc" },
    select: { summary: true },
  });
  const result = await generateContentGaps({
    periodLabel,
    digest,
    marketSummary: trends?.summary ?? "No market read available yet.",
  });
  await prisma.intelligenceReport.upsert({
    where: { kind_periodKey: { kind: "CONTENT_GAPS", periodKey } },
    create: { kind: "CONTENT_GAPS", periodKey, summary: result.summary, data: result.data, model: result.model },
    update: { summary: result.summary, data: result.data, model: result.model, generatedAt: new Date() },
  });
  return true;
}

/** Generate today's ideas batch (idempotent per IST day unless forced). */
export async function generateDailyIdeas(now: Date, force = false): Promise<number> {
  const batchDate = istDateKey(now);
  if (!force) {
    const existing = await prisma.contentIdea.count({ where: { batchDate } });
    if (existing > 0) return 0;
  }
  const settings = await getIntelligenceSettings();
  const social = await getSocialSettings();
  const [trends, gaps, recent] = await Promise.all([
    prisma.intelligenceReport.findFirst({
      where: { kind: "MARKET_TRENDS" },
      orderBy: { generatedAt: "desc" },
    }),
    prisma.intelligenceReport.findFirst({
      where: { kind: "CONTENT_GAPS" },
      orderBy: { generatedAt: "desc" },
    }),
    prisma.contentIdea.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      select: { topic: true },
    }),
  ]);
  const trendsData = (trends?.data ?? null) as MarketTrendsData | null;
  const gapsData = (gaps?.data ?? null) as ContentGapsData | null;
  const { ideas } = await generateContentIdeas({
    count: settings.ideasPerBatch,
    minScore: settings.minIdeaScore,
    brandVoice: social.brandVoice,
    trendsSummary: trends?.summary ?? "No trends report yet.",
    gapsSummary: gaps?.summary ?? "No gap analysis yet.",
    trendTopics: trendsData?.trendingTopics.map((t) => t.topic) ?? [],
    gapTopics: gapsData?.gaps.map((g) => g.gap) ?? [],
    existingTopics: recent.map((r) => r.topic),
  });
  if (!ideas.length) return 0;
  await prisma.contentIdea.createMany({
    data: ideas.map((i) => ({
      topic: i.topic,
      rationale: i.rationale,
      audience: i.audience,
      format: i.format,
      difficulty: i.difficulty,
      engagementPotential: i.engagementPotential,
      bestTime: i.bestTime,
      cta: i.cta,
      scores: i.scores,
      totalScore: i.totalScore,
      batchDate,
    })),
  });
  return ideas.length;
}

// ── The cycle (cron + admin "Run now") ───────────────────────────────────────

export type IntelligenceCycleResult = {
  skipped?: string;
  seeded: number;
  profilesRefreshed: number;
  weeklyTrends: boolean;
  monthlyTrends: boolean;
  gaps: boolean;
  ideas: number;
};

export async function runIntelligenceCycle(
  now: Date,
  opts: { force?: boolean } = {},
): Promise<IntelligenceCycleResult> {
  const empty: IntelligenceCycleResult = {
    seeded: 0,
    profilesRefreshed: 0,
    weeklyTrends: false,
    monthlyTrends: false,
    gaps: false,
    ideas: 0,
  };
  const settings = await getIntelligenceSettings();
  if (!settings.enabled && !opts.force) return { ...empty, skipped: "disabled" };
  // The cron fires all day; generation only starts once the configured IST
  // morning hour has passed, so reports/ideas are "fresh every morning".
  if (!opts.force && istHour(now) < settings.runHour) {
    return { ...empty, skipped: `before ${settings.runHour}:00 IST` };
  }

  const seeded = await ensureDefaultCompetitors();
  const digest = await buildSignalDigest(now);

  // Refresh stale competitor profiles, highest priority first, capped per run.
  const staleBefore = new Date(now.getTime() - settings.competitorRefreshDays * 24 * 3600 * 1000);
  const stale = await prisma.competitor.findMany({
    where: {
      active: true,
      OR: [{ lastAnalyzedAt: null }, { lastAnalyzedAt: { lt: staleBefore } }],
    },
    orderBy: [{ priority: "asc" }, { lastAnalyzedAt: { sort: "asc", nulls: "first" } }],
    take: PROFILES_PER_RUN,
  });
  let profilesRefreshed = 0;
  for (const c of stale) {
    try {
      await runCompetitorProfile(c);
      profilesRefreshed++;
    } catch (e) {
      console.error(`[intelligence] profile failed for ${c.name}:`, e);
    }
  }

  const weekKey = istWeekKey(now);
  const monthKey = istMonthKey(now);
  const weeklyTrends = await ensureTrendsReport(now, weekKey, `week ${weekKey}`, digest);
  const monthlyTrends = await ensureTrendsReport(now, monthKey, monthLabel(now), digest);
  const gaps = await ensureGapsReport(now, weekKey, `week ${weekKey}`, digest);
  const ideas = await generateDailyIdeas(now);

  return { seeded, profilesRefreshed, weeklyTrends, monthlyTrends, gaps, ideas };
}
