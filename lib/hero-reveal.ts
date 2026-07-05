/**
 * Hero "Product Reveal" animation — admin-editable config for the optional
 * packet-pour overlay on the homepage hero slider. Stored in the additive
 * `StoreSetting.heroReveal` JSON blob (same pattern as `growth`/`pwa`/`seo`);
 * `resolveHeroReveal` folds the blob over defaults so callers always get a
 * complete, typed config. Client-safe — no Prisma imports (the DB query lives
 * in `lib/queries/home.ts#getHeroRevealSettings`).
 */

export type HeroRevealBlob = {
  enabled?: boolean;
  /** Packet PNG (transparent background preferred). Required to go live. */
  packetImage?: string;
  /** Single makhana-piece PNG; "" = built-in default sprite. */
  pieceImage?: string;
  /** 0–100 animation speed knob (50 = designed pace). */
  speed?: number;
  /** Seconds before the first run and between loops. */
  delaySec?: number;
  /** Number of falling pieces (mobile caps this lower). */
  pieceCount?: number;
};

export type HeroRevealSettings = Required<HeroRevealBlob>;

export const HERO_REVEAL_DEFAULTS: HeroRevealSettings = {
  enabled: false,
  packetImage: "",
  pieceImage: "",
  speed: 50,
  delaySec: 3,
  pieceCount: 8,
};

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function clampNum(v: unknown, min: number, max: number, fallback: number, int = true): number {
  const n = int ? Math.round(Number(v)) : Number(v);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** Pure fold of a stored blob over defaults. */
export function resolveHeroReveal(blob: unknown): HeroRevealSettings {
  const b = (blob && typeof blob === "object" ? blob : {}) as HeroRevealBlob;
  return {
    enabled: b.enabled === true,
    packetImage: s(b.packetImage),
    pieceImage: s(b.pieceImage),
    speed: clampNum(b.speed, 0, 100, HERO_REVEAL_DEFAULTS.speed),
    delaySec: clampNum(b.delaySec, 0, 15, HERO_REVEAL_DEFAULTS.delaySec, false),
    pieceCount: clampNum(b.pieceCount, 4, 16, HERO_REVEAL_DEFAULTS.pieceCount),
  };
}

/** The overlay renders only when enabled AND a packet image is set. */
export const heroRevealLive = (s: HeroRevealSettings): boolean =>
  s.enabled && s.packetImage !== "";
