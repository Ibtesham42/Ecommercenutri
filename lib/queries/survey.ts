import { prisma } from "@/lib/prisma";
import type { SurveyResponse } from "@prisma/client";
import { SURVEY_QUESTIONS } from "@/lib/survey";

/**
 * Admin analytics for the public survey. Aggregation happens in JS over one
 * bounded fetch — survey volume is small (thousands at most), and this keeps
 * the option keys/labels in lockstep with the lib/survey.ts catalog.
 */

export type SurveyOptionStat = { key: string; count: number; pct: number };
export type SurveyQuestionStat = {
  id: string;
  num: number;
  type: "single" | "multi";
  answered: number;
  options: SurveyOptionStat[];
};

export type SurveyStats = {
  total: number;
  last7d: number;
  optIns: number;
  topCities: { city: string; count: number }[];
  byDay: { day: string; count: number }[];
  questions: SurveyQuestionStat[];
};

const MAX_ROWS = 20000;

export async function getSurveyResponses(limit = 200): Promise<SurveyResponse[]> {
  try {
    return await prisma.surveyResponse.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } catch {
    return [];
  }
}

export async function getAllSurveyResponses(): Promise<SurveyResponse[]> {
  try {
    return await prisma.surveyResponse.findMany({
      orderBy: { createdAt: "desc" },
      take: MAX_ROWS,
    });
  } catch {
    return [];
  }
}

export async function getSurveyStats(): Promise<SurveyStats> {
  const rows = await getAllSurveyResponses();
  const total = rows.length;
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

  // Per-day counts, last 30 days (ISO day keys, oldest first).
  const byDayMap = new Map<string, number>();
  for (const r of rows) {
    const day = r.createdAt.toISOString().slice(0, 10);
    byDayMap.set(day, (byDayMap.get(day) ?? 0) + 1);
  }
  const byDay = [...byDayMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-30)
    .map(([day, count]) => ({ day, count }));

  // City leaderboard (free text — normalized to lowercase for grouping).
  const cityMap = new Map<string, { city: string; count: number }>();
  for (const r of rows) {
    const c = r.city?.trim();
    if (!c) continue;
    const k = c.toLowerCase();
    const cur = cityMap.get(k);
    if (cur) cur.count += 1;
    else cityMap.set(k, { city: c, count: 1 });
  }
  const topCities = [...cityMap.values()].sort((a, b) => b.count - a.count).slice(0, 8);

  // Per-question option breakdowns. For multi-selects the percentage base is
  // respondents (how many pick each option), so bars read as "% of people".
  const questions: SurveyQuestionStat[] = SURVEY_QUESTIONS.filter(
    (q) => q.type !== "text" && q.options,
  ).map((q) => {
    const counts = new Map<string, number>();
    let answered = 0;
    for (const r of rows) {
      const v = r[q.id as keyof SurveyResponse];
      if (q.type === "single") {
        if (typeof v === "string" && v) {
          answered += 1;
          counts.set(v, (counts.get(v) ?? 0) + 1);
        }
      } else if (Array.isArray(v)) {
        if (v.length > 0) answered += 1;
        for (const key of v) counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
    return {
      id: q.id,
      num: q.num,
      type: q.type as "single" | "multi",
      answered,
      options: (q.options ?? []).map((o) => {
        const count = counts.get(o.key) ?? 0;
        const base = q.type === "single" ? answered : total;
        return { key: o.key, count, pct: base > 0 ? Math.round((count / base) * 100) : 0 };
      }),
    };
  });

  return {
    total,
    last7d: rows.filter((r) => r.createdAt.getTime() >= weekAgo).length,
    optIns: rows.filter((r) => r.wantsUpdates === "yes").length,
    topCities,
    byDay,
    questions,
  };
}
