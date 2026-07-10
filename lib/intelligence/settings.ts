import { prisma } from "@/lib/prisma";

/**
 * Competitor Intelligence config — stored in the additive
 * `StoreSetting.intelligence` JSON blob (same zero-migration pattern as
 * `social`/`growth`). `resolveIntelligence` folds the blob over defaults so
 * callers always get a complete, typed config; defaults on DB error.
 */

export type IntelligenceBlob = {
  enabled?: boolean;
  runHour?: number; // IST hour (0-23) after which the daily cycle may run
  competitorRefreshDays?: number; // re-analyze a competitor profile after N days
  ideasPerBatch?: number; // content ideas generated each morning
  minIdeaScore?: number; // only ideas scoring >= this are "recommended"
};

export type IntelligenceSettings = Required<IntelligenceBlob>;

export const INTELLIGENCE_DEFAULTS: IntelligenceSettings = {
  enabled: true,
  runHour: 7, // fresh insights ready before the workday
  competitorRefreshDays: 7,
  ideasPerBatch: 20,
  minIdeaScore: 90,
};

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= min && n <= max ? n : fallback;
}

/** Pure fold of a stored blob over defaults. */
export function resolveIntelligence(blob: unknown): IntelligenceSettings {
  const b = (blob && typeof blob === "object" ? blob : {}) as IntelligenceBlob;
  return {
    enabled: b.enabled !== false,
    runHour: clampInt(b.runHour, 0, 23, INTELLIGENCE_DEFAULTS.runHour),
    competitorRefreshDays: clampInt(
      b.competitorRefreshDays, 1, 30, INTELLIGENCE_DEFAULTS.competitorRefreshDays,
    ),
    ideasPerBatch: clampInt(b.ideasPerBatch, 5, 30, INTELLIGENCE_DEFAULTS.ideasPerBatch),
    minIdeaScore: clampInt(b.minIdeaScore, 50, 100, INTELLIGENCE_DEFAULTS.minIdeaScore),
  };
}

/** Resolved intelligence config. Defaults on DB error (never throws). */
export async function getIntelligenceSettings(): Promise<IntelligenceSettings> {
  try {
    const row = await prisma.storeSetting.findUnique({
      where: { id: "singleton" },
      select: { intelligence: true },
    });
    return resolveIntelligence(row?.intelligence);
  } catch {
    return INTELLIGENCE_DEFAULTS;
  }
}
