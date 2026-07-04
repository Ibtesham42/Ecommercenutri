import "server-only";
import { prisma } from "@/lib/prisma";
import { resolveRange, type RangeInput } from "@/lib/queries/analytics";

/**
 * Conversion-optimization analytics (Phase 1 growth features) — the quiz +
 * welcome-popup + sticky-bar funnels, scoped to the admin's range and compared
 * to the previous window. Additive companion to the other analytics queries;
 * counts the dedicated UserEvent types the growth components emit. Degrades to
 * zeros before any data exists.
 */

export type ConversionMetric = {
  key: string;
  label: string;
  value: number;
  prev: number;
  deltaPct: number | null;
  sub?: string;
};

export type ConversionAnalytics = {
  rangeLabel: string;
  hasData: boolean;
  quiz: { starts: number; completes: number; signups: number; completionRate: number; signupRate: number };
  metrics: ConversionMetric[];
};

const TYPES = [
  "QUIZ_START",
  "QUIZ_COMPLETE",
  "QUIZ_SIGNUP",
  "COUPON_CLAIM",
  "POPUP_VIEW",
  "POPUP_CONVERT",
  "STICKY_CLICK",
] as const;

function delta(cur: number, prev: number): number | null {
  if (cur === 0 && prev === 0) return null;
  if (prev === 0) return cur > 0 ? 100 : 0;
  return ((cur - prev) / prev) * 100;
}

export async function getConversionAnalytics(input: RangeInput): Promise<ConversionAnalytics> {
  const r = resolveRange(input);
  try {
    const rows = await prisma.userEvent.findMany({
      where: { type: { in: [...TYPES] }, createdAt: { gte: r.prevFrom, lt: r.to } },
      select: { type: true, createdAt: true },
      take: 50_000,
    });

    const cur: Record<string, number> = {};
    const prev: Record<string, number> = {};
    for (const row of rows) {
      const bucket = row.createdAt >= r.from ? cur : prev;
      bucket[row.type] = (bucket[row.type] ?? 0) + 1;
    }
    const c = (t: string) => cur[t] ?? 0;
    const p = (t: string) => prev[t] ?? 0;

    const starts = c("QUIZ_START");
    const completes = c("QUIZ_COMPLETE");
    const signups = c("QUIZ_SIGNUP");
    const completionRate = starts > 0 ? (completes / starts) * 100 : 0;
    const signupRate = completes > 0 ? (signups / completes) * 100 : 0;

    const metrics: ConversionMetric[] = [
      { key: "quizStart", label: "Quiz started", value: starts, prev: p("QUIZ_START"), deltaPct: delta(starts, p("QUIZ_START")) },
      {
        key: "quizComplete",
        label: "Quiz completed",
        value: completes,
        prev: p("QUIZ_COMPLETE"),
        deltaPct: delta(completes, p("QUIZ_COMPLETE")),
        sub: starts > 0 ? `${completionRate.toFixed(0)}% completion` : undefined,
      },
      {
        key: "quizSignup",
        label: "Signup from quiz",
        value: signups,
        prev: p("QUIZ_SIGNUP"),
        deltaPct: delta(signups, p("QUIZ_SIGNUP")),
        sub: completes > 0 ? `${signupRate.toFixed(0)}% of completers` : undefined,
      },
      { key: "coupon", label: "Coupon claimed", value: c("COUPON_CLAIM"), prev: p("COUPON_CLAIM"), deltaPct: delta(c("COUPON_CLAIM"), p("COUPON_CLAIM")) },
      { key: "popupView", label: "Welcome popup viewed", value: c("POPUP_VIEW"), prev: p("POPUP_VIEW"), deltaPct: delta(c("POPUP_VIEW"), p("POPUP_VIEW")) },
      {
        key: "popupConvert",
        label: "Welcome popup converted",
        value: c("POPUP_CONVERT"),
        prev: p("POPUP_CONVERT"),
        deltaPct: delta(c("POPUP_CONVERT"), p("POPUP_CONVERT")),
        sub: c("POPUP_VIEW") > 0 ? `${((c("POPUP_CONVERT") / c("POPUP_VIEW")) * 100).toFixed(0)}% CTR` : undefined,
      },
      { key: "sticky", label: "Sticky bar clicked", value: c("STICKY_CLICK"), prev: p("STICKY_CLICK"), deltaPct: delta(c("STICKY_CLICK"), p("STICKY_CLICK")) },
    ];

    const hasData = metrics.some((m) => m.value > 0 || m.prev > 0);
    return {
      rangeLabel: r.label,
      hasData,
      quiz: { starts, completes, signups, completionRate, signupRate },
      metrics,
    };
  } catch (err) {
    console.error("[conversion] query failed:", err);
    return {
      rangeLabel: r.label,
      hasData: false,
      quiz: { starts: 0, completes: 0, signups: 0, completionRate: 0, signupRate: 0 },
      metrics: [],
    };
  }
}
