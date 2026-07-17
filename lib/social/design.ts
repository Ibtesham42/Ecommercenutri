/**
 * Colour harmony for social post creatives: deriving a palette from a product
 * photo's own dominant colours, never a random or fixed one.
 *
 * The old Cloudinary URL-transform compositor (templates, text-layer chains)
 * lived here too; it has been replaced end-to-end by the satori/@vercel/og
 * renderer in lib/social/creative/. This module now holds only the colour
 * maths that both the old and new engines share, plus `stripTransforms`,
 * which lib/social/creative/compose.ts still uses to get back to a clean
 * Cloudinary asset before applying its own (trim/fit/round) prep transform.
 *
 * Pure and client-safe (no DB / no Cloudinary SDK) so the admin preview and
 * the composer can both call `derivePalette` with the same result. Dominant
 * colours are fetched server-side (lib/social/palette.ts) and passed in.
 */

export const CANVAS = 1080;

// ── Colour maths ─────────────────────────────────────────────────────────────

export type Rgb = { r: number; g: number; b: number };
export type Hsl = { h: number; s: number; l: number };

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const n = parseInt(full.slice(0, 6), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** Always `#RRGGBB` — every consumer (CSS-in-JS for the creative renderer,
 *  Cloudinary URL params) can strip the `#` itself, but only one of those two
 *  needs to, so the canonical form includes it. */
export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}

export function rgbToHsl({ r, g, b }: Rgb): Hsl {
  const R = r / 255, G = g / 255, B = b / 255;
  const max = Math.max(R, G, B), min = Math.min(R, G, B);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === R) h = ((G - B) / d + (G < B ? 6 : 0)) / 6;
  else if (max === G) h = ((B - R) / d + 2) / 6;
  else h = ((R - G) / d + 4) / 6;
  return { h: h * 360, s, l };
}

export function hslToRgb({ h, s, l }: Hsl): Rgb {
  const H = ((h % 360) + 360) % 360 / 360;
  if (s === 0) return { r: l * 255, g: l * 255, b: l * 255 };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const hue = (t: number) => {
    let T = t;
    if (T < 0) T += 1;
    if (T > 1) T -= 1;
    if (T < 1 / 6) return p + (q - p) * 6 * T;
    if (T < 1 / 2) return q;
    if (T < 2 / 3) return p + (q - p) * (2 / 3 - T) * 6;
    return p;
  };
  return { r: hue(H + 1 / 3) * 255, g: hue(H) * 255, b: hue(H - 1 / 3) * 255 };
}

const srgb = (v: number) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};

export function relativeLuminance(rgb: Rgb): number {
  return 0.2126 * srgb(rgb.r) + 0.7152 * srgb(rgb.g) + 0.0722 * srgb(rgb.b);
}

/** WCAG contrast ratio, 1–21. */
export function contrastRatio(aHex: string, bHex: string): number {
  const la = relativeLuminance(hexToRgb(aHex));
  const lb = relativeLuminance(hexToRgb(bHex));
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// ── Palette ──────────────────────────────────────────────────────────────────

export type Palette = {
  /** Canvas background, `#RRGGBB`. */
  bg: string;
  /** Headline colour, `#RRGGBB`. */
  ink: string;
  /** Accent for the kicker / supporting line, `#RRGGBB`. */
  accent: string;
  /** How the product photo read: light, dark or colourful. */
  mood: "light" | "dark" | "vivid";
};

/** Brand fallbacks — used when the photo has no usable colour (or keyless). */
export const BRAND_PALETTE: Palette = {
  bg: "#F5EFE3", // warm cream
  ink: "#1F3A2E", // deep green
  accent: "#B08542", // gold
  mood: "light",
};

const GOLD = "#B08542";
const CREAM = "#F5EFE3";
const NEAR_WHITE = "#FBF8F2";
const DEEP_INK = "#1B1B1A";

/**
 * Derive a harmonious palette from the product photo's dominant colours.
 *
 * `colors` is Cloudinary's list, most-dominant first, as [hex, percent]. Greys
 * and near-white/near-black are skipped when choosing the HUE (a white studio
 * background must not decide the palette) but they still tell us the mood.
 */
export function derivePalette(colors: [string, number][]): Palette {
  if (!colors.length) return BRAND_PALETTE;

  const parsed = colors.map(([hex, pct]) => {
    const rgb = hexToRgb(hex);
    return { hex, pct, hsl: rgbToHsl(rgb), lum: relativeLuminance(rgb) };
  });

  // The photo's overall lightness, weighted by how much of the frame each colour
  // occupies — this is what tells a black pouch from a white one.
  const totalPct = parsed.reduce((a, c) => a + c.pct, 0) || 1;
  const avgLum = parsed.reduce((a, c) => a + c.lum * c.pct, 0) / totalPct;

  // The hue driver: the most dominant colour that is actually chromatic.
  const chromatic = parsed
    .filter((c) => c.hsl.s > 0.18 && c.hsl.l > 0.12 && c.hsl.l < 0.9)
    .sort((a, b) => b.pct - a.pct)[0];

  // No real colour anywhere (grey/white/black packaging) → brand neutrals, with
  // the type flipped to suit a dark or light product.
  if (!chromatic) {
    return avgLum < 0.2
      ? { bg: DEEP_INK, ink: NEAR_WHITE, accent: GOLD, mood: "dark" }
      : { bg: CREAM, ink: BRAND_PALETTE.ink, accent: GOLD, mood: "light" };
  }

  const { h, s } = chromatic.hsl;

  // Very dark product (black/deep pouch) → deep tinted canvas, gold + white type.
  if (avgLum < 0.18) {
    return {
      bg: rgbToHex(hslToRgb({ h, s: Math.min(0.25, s), l: 0.11 })),
      ink: NEAR_WHITE,
      accent: GOLD,
      mood: "dark",
    };
  }

  // Everything else: a soft tint of the product's own hue, with deep type of the
  // same family — the "handcrafted, obviously belongs together" look.
  const bg = rgbToHex(hslToRgb({ h, s: Math.min(0.22, Math.max(0.08, s * 0.35)), l: 0.92 }));
  let ink = rgbToHex(hslToRgb({ h, s: Math.min(0.45, Math.max(0.25, s * 0.7)), l: 0.2 }));

  // Contrast is checked, never assumed — if the derived ink is too close to the
  // canvas, fall back to the brand deep green, then to near-black.
  if (contrastRatio(ink, bg) < 4.5) ink = BRAND_PALETTE.ink;
  if (contrastRatio(ink, bg) < 4.5) ink = DEEP_INK;

  // The accent must also survive on the canvas; gold is the brand default, but a
  // deeper tone of the product hue wins when gold would be illegible.
  let accent = GOLD;
  if (contrastRatio(accent, bg) < 3) {
    accent = rgbToHex(hslToRgb({ h, s: Math.min(0.6, s), l: 0.32 }));
  }
  if (contrastRatio(accent, bg) < 3) accent = ink;

  return { bg, ink, accent, mood: s > 0.5 ? "vivid" : "light" };
}

// ── Cloudinary URL helpers ───────────────────────────────────────────────────

/**
 * Reduce any Cloudinary delivery URL back to the untransformed asset, so
 * preparing a product cutout is idempotent (a post can be regenerated any
 * number of times without stacking transforms). Keeps the version + public_id,
 * drops every transformation segment.
 */
export function stripTransforms(url: string): string {
  const [prefix, rest] = url.split("/upload/");
  if (!rest) return url;
  const segments = rest.split("/");
  // Transformation segments are comma-separated `xx_yy` params; the asset path
  // starts at the version (`v123…`) or the first non-transformation segment.
  while (
    segments.length > 1 &&
    /(^|,)[a-z]{1,3}_[^/]*$/.test(segments[0]) &&
    !/^v\d+$/.test(segments[0])
  ) {
    segments.shift();
  }
  return `${prefix}/upload/${segments.join("/")}`;
}
