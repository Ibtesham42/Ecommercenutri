/**
 * Instagram post image design: colour harmony + rotating premium templates.
 *
 * Posts used to publish the bare product photo. This composes a designed 1080²
 * square entirely with Cloudinary URL transformations — no serverless image
 * processing, no new dependency, and the product bytes never move.
 *
 * Two rules drive everything:
 *  - Colour is DERIVED from the product photo's own dominant colours (never
 *    random): the canvas is a soft tint of the product's hue, the type is a deep
 *    or light tone of the same family, and contrast is checked, not assumed.
 *  - The product is never covered: every template pads the product into its own
 *    region and places type in the empty space around it.
 *
 * Pure and client-safe (no DB / no Cloudinary SDK) so the admin preview and the
 * publisher build the exact same URL. Dominant colours are fetched server-side
 * (lib/social/palette.ts) and passed in.
 *
 * NOTE: Cloudinary does NOT support our brand serif (Fraunces) — verified
 * against the account. Playfair Display is the closest supported substitute;
 * Montserrat is the supporting sans. Do not swap these without re-probing.
 */

export const SERIF = "Playfair Display";
export const SANS = "Montserrat";

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

export function rgbToHex({ r, g, b }: Rgb): string {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `${c(r)}${c(g)}${c(b)}`.toUpperCase();
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
  /** Canvas background. */
  bg: string;
  /** Headline colour. */
  ink: string;
  /** Accent for the kicker / supporting line. */
  accent: string;
  /** How the product photo read: light, dark or colourful. */
  mood: "light" | "dark" | "vivid";
};

/** Brand fallbacks — used when the photo has no usable colour (or keyless). */
export const BRAND_PALETTE: Palette = {
  bg: "F5EFE3", // warm cream
  ink: "1F3A2E", // deep green
  accent: "B08542", // gold
  mood: "light",
};

const GOLD = "B08542";
const CREAM = "F5EFE3";
const NEAR_WHITE = "FBF8F2";
const DEEP_INK = "1B1B1A";

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
    return { hex: hex.replace("#", ""), pct, hsl: rgbToHsl(rgb), lum: relativeLuminance(rgb) };
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

// ── Templates ────────────────────────────────────────────────────────────────

export type DesignTemplate = {
  key: string;
  label: string;
  /** Product box (px, within the 1080² canvas) and where it sits. */
  product: { w: number; h: number; gravity: string; y: number };
  headline: {
    font: string;
    size: number;
    weight: "bold" | "normal";
    style?: "italic";
    gravity: string;
    x: number;
    y: number;
    width: number;
    align: "left" | "center";
    uppercase?: boolean;
    letterSpacing?: number;
  };
  /** Optional supporting line (kicker or subtext). */
  support?: {
    font: string;
    size: number;
    gravity: string;
    x: number;
    y: number;
    width: number;
    align: "left" | "center";
    uppercase?: boolean;
    letterSpacing?: number;
    useAccent?: boolean;
  };
};

/**
 * Layouts differ in product placement, type position, face, scale and casing —
 * so consecutive posts look genuinely different. None of them puts type over the
 * product: the product owns its box, the type owns the space around it.
 */
export const DESIGN_TEMPLATES: DesignTemplate[] = [
  {
    key: "MINIMAL",
    label: "Minimal",
    product: { w: 720, h: 640, gravity: "south", y: 90 },
    headline: {
      font: SERIF, size: 62, weight: "bold", gravity: "north", x: 0, y: 96,
      width: 840, align: "center",
    },
  },
  {
    key: "EDITORIAL",
    label: "Editorial",
    product: { w: 620, h: 620, gravity: "south_east", y: 60 },
    headline: {
      font: SERIF, size: 58, weight: "bold", gravity: "north_west", x: 80, y: 130,
      width: 620, align: "left",
    },
    support: {
      font: SANS, size: 26, gravity: "north_west", x: 84, y: 84,
      width: 600, align: "left", uppercase: true, letterSpacing: 4, useAccent: true,
    },
  },
  {
    key: "FACT_CARD",
    label: "Health Fact Card",
    product: { w: 660, h: 560, gravity: "south", y: 64 },
    headline: {
      font: SANS, size: 54, weight: "bold", gravity: "north", x: 0, y: 96,
      width: 860, align: "center", uppercase: true, letterSpacing: 1,
    },
    support: {
      font: SANS, size: 30, gravity: "north", x: 0, y: 250,
      width: 760, align: "center", useAccent: true,
    },
  },
  {
    key: "PRODUCT_FOCUS",
    label: "Premium Product Focus",
    product: { w: 860, h: 700, gravity: "center", y: -40 },
    headline: {
      font: SANS, size: 40, weight: "bold", gravity: "south", x: 0, y: 90,
      width: 900, align: "center", uppercase: true, letterSpacing: 6,
    },
  },
  {
    key: "QUOTE",
    label: "Quote",
    product: { w: 420, h: 420, gravity: "south_east", y: 60 },
    headline: {
      font: SERIF, size: 64, weight: "normal", style: "italic",
      gravity: "north_west", x: 80, y: 140, width: 660, align: "left",
    },
  },
  {
    key: "CLEAN_LIFESTYLE",
    label: "Clean Lifestyle",
    product: { w: 560, h: 700, gravity: "west", y: 0 },
    headline: {
      font: SERIF, size: 56, weight: "bold", gravity: "east", x: 70, y: -40,
      width: 420, align: "left",
    },
    support: {
      font: SANS, size: 26, gravity: "east", x: 74, y: 130,
      width: 400, align: "left", useAccent: true,
    },
  },
];

export const DESIGN_LABEL: Record<string, string> = Object.fromEntries(
  DESIGN_TEMPLATES.map((t) => [t.key, t.label]),
);

/** Rotate templates deterministically; never repeat the previous layout. */
export function pickDesign(rotation: number, recentDesignKeys: string[]): DesignTemplate {
  const avoid = new Set(recentDesignKeys.slice(0, Math.min(2, DESIGN_TEMPLATES.length - 1)));
  const start = ((rotation % DESIGN_TEMPLATES.length) + DESIGN_TEMPLATES.length) % DESIGN_TEMPLATES.length;
  for (let i = 0; i < DESIGN_TEMPLATES.length; i++) {
    const cand = DESIGN_TEMPLATES[(start + i) % DESIGN_TEMPLATES.length];
    if (!avoid.has(cand.key)) return cand;
  }
  return DESIGN_TEMPLATES[start];
}

// ── URL composition ──────────────────────────────────────────────────────────

/**
 * Cloudinary text layers are a URL path segment, so any character that is
 * structural in a URL (or in Cloudinary's own transformation grammar) has to go.
 * Commas and slashes break the transformation; % breaks the escape. Double-encode
 * per Cloudinary's rules for text overlays.
 */
export function encodeOverlayText(text: string): string {
  const cleaned = text
    .replace(/[\/,%]/g, " ") // structural in Cloudinary's grammar
    .replace(/["“”]/g, "") // smart quotes render as boxes in some faces
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 70);
  return encodeURIComponent(encodeURIComponent(cleaned));
}

function textLayer(
  text: string,
  cfg: {
    font: string; size: number; weight?: string; style?: string; color: string;
    gravity: string; x: number; y: number; width: number; align: string;
    letterSpacing?: number;
  },
): string {
  const font = cfg.font.replace(/\s+/g, "%20");
  const parts = [font, String(cfg.size)];
  if (cfg.weight === "bold") parts.push("bold");
  if (cfg.style === "italic") parts.push("italic");
  // Letter spacing is part of the FONT SPEC, not a standalone transformation
  // parameter — `ls_6` is rejected by Cloudinary as an invalid parameter.
  if (cfg.letterSpacing) parts.push(`letter_spacing_${cfg.letterSpacing}`);
  const spec = parts.join("_");
  return [
    `l_text:${spec}:${encodeOverlayText(text)}`,
    `co_rgb:${cfg.color}`,
    `c_fit,w_${cfg.width}`,
    `g_${cfg.gravity}`,
    `x_${cfg.x}`,
    `y_${cfg.y}`,
  ].join(",");
}

/**
 * Reduce any Cloudinary delivery URL back to the untransformed asset, so
 * designing is idempotent (a post can be regenerated any number of times without
 * accumulating overlays). Keeps the version + public_id, drops every
 * transformation segment.
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

export type DesignInput = {
  imageUrl: string;
  headline: string;
  support?: string | null;
  template: DesignTemplate;
  palette: Palette;
};

/**
 * Compose the designed post image as a Cloudinary URL.
 *
 * The chain: trim the product's own border → fit it into the template's box
 * (c_fit never crops or upscales the product) → pad onto the palette canvas →
 * lay the type into the empty space. Non-Cloudinary URLs are returned unchanged,
 * so a pasted external image still publishes (undesigned) rather than breaking.
 */
export function buildDesignedImageUrl(input: DesignInput): string {
  const { headline, support, template: t, palette } = input;
  if (!input.imageUrl.includes("res.cloudinary.com") || !input.imageUrl.includes("/upload/")) {
    return input.imageUrl;
  }
  // Design from the ORIGINAL asset. Regenerating a post feeds back a URL that is
  // already designed; without this we would stack a second headline on top of
  // the first. Stripping makes the operation idempotent.
  const imageUrl = stripTransforms(input.imageUrl);

  const chain: string[] = [
    // Product: trimmed, fitted into its box, softly rounded, then padded onto
    // the canvas.
    //
    // c_lpad, NOT c_pad — c_pad resizes-then-pads, which scales the fitted
    // product back UP to fill the canvas and shoves it under the headline.
    // c_lpad pads without ever enlarging, so the product keeps its box and the
    // type keeps its empty space.
    //
    // r_24 turns the photo's own (usually white) background into a deliberate
    // rounded card instead of a stray rectangle on the tinted canvas. We do NOT
    // use e_make_transparent to knock the white out: it works on clean cut-outs
    // but shreds lifestyle photography (verified — it punched holes straight
    // through the makhana scene and its pale fox nuts).
    `e_trim:10`,
    `c_fit,w_${t.product.w},h_${t.product.h}`,
    `r_24`,
    `c_lpad,w_${CANVAS},h_${CANVAS},b_rgb:${palette.bg},g_${t.product.gravity},y_${t.product.y}`,
  ];

  const head = t.headline.uppercase ? headline.toUpperCase() : headline;
  chain.push(
    textLayer(head, {
      font: t.headline.font,
      size: t.headline.size,
      weight: t.headline.weight,
      style: t.headline.style,
      color: palette.ink,
      gravity: t.headline.gravity,
      x: t.headline.x,
      y: t.headline.y,
      width: t.headline.width,
      align: t.headline.align,
      letterSpacing: t.headline.letterSpacing,
    }),
  );

  if (support && t.support) {
    const sup = t.support.uppercase ? support.toUpperCase() : support;
    chain.push(
      textLayer(sup, {
        font: t.support.font,
        size: t.support.size,
        color: t.support.useAccent ? palette.accent : palette.ink,
        gravity: t.support.gravity,
        x: t.support.x,
        y: t.support.y,
        width: t.support.width,
        align: t.support.align,
        letterSpacing: t.support.letterSpacing,
      }),
    );
  }

  chain.push("f_auto,q_auto");
  return imageUrl.replace("/upload/", `/upload/${chain.join("/")}/`);
}
