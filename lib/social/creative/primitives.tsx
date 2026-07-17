import type { ReactNode, CSSProperties } from "react";
import type { Palette } from "@/lib/social/design";
import { SERIF, SANS } from "@/lib/social/creative/fonts";
import { ICONS } from "@/lib/social/creative/icons";

/**
 * Shared layout building blocks for the satori/@vercel/og creative renderer
 * (lib/social/creative/render.tsx). Every "look" composes the SAME small set
 * of primitives differently — that keeps 7 very different layouts from turning
 * into 7 one-off 200-line JSX trees, and keeps them visually consistent as one
 * design system (same card language, same chip language, same icon set).
 *
 * These are plain functions, not React components with hooks: satori evaluates
 * the element tree directly (no reconciler), so state/effects are unavailable
 * here — everything is pure props-in, JSX-out.
 */

/** Deterministic icon-per-benefit so the same phrase always gets the same
 *  glyph across regenerations, without needing a lookup table to maintain. */
function iconFor(index: number, text: string) {
  let h = 0;
  for (let i = 0; i < text.length; i++) h = (h * 31 + text.charCodeAt(i)) >>> 0;
  const Icon = ICONS[(h + index) % ICONS.length];
  return Icon;
}

const withAlpha = (hex: string, alpha: number) => {
  const h = hex.replace("#", "");
  const n = parseInt(h.length === 3 ? h.split("").map((c) => c + c).join("") : h, 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

/**
 * A rounded, slightly translucent "glass" surface: no real backdrop-blur (not
 * reliably supported by resvg), so the glass read comes from a soft tinted
 * fill + a hairline light border + a soft drop shadow — the same trick real
 * frosted-card designs use as a fallback for non-blur renderers.
 */
export function GlassCard({
  palette,
  children,
  style,
  dark = false,
}: {
  palette: Palette;
  children: ReactNode;
  style?: CSSProperties;
  dark?: boolean;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 28,
        background: dark ? withAlpha("#0A0A08", 0.38) : withAlpha("#FFFFFF", 0.6),
        border: `1px solid ${dark ? withAlpha("#FFFFFF", 0.14) : withAlpha("#FFFFFF", 0.8)}`,
        boxShadow: `0 24px 48px ${withAlpha(palette.ink, 0.16)}`,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export function BenefitChip({
  text,
  index,
  palette,
  dark = false,
}: {
  text: string;
  index: number;
  palette: Palette;
  dark?: boolean;
}) {
  const Icon = iconFor(index, text);
  const fg = dark ? "#FFFFFF" : palette.ink;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "14px 22px",
        borderRadius: 999,
        background: dark ? withAlpha("#FFFFFF", 0.12) : withAlpha("#FFFFFF", 0.72),
        border: `1px solid ${dark ? withAlpha("#FFFFFF", 0.2) : withAlpha(palette.ink, 0.08)}`,
      }}
    >
      <Icon color={palette.accent} size={26} strokeWidth={2.25} />
      <span
        style={{
          fontFamily: SANS,
          fontWeight: 600,
          fontSize: 26,
          color: fg,
          letterSpacing: -0.2,
        }}
      >
        {text}
      </span>
    </div>
  );
}

/** A grid cell for the INFOGRAPHIC look — a rectangular card (not a pill), icon
 *  in its own circle above the label, so a 2x2 grid of these reads as a
 *  reference sheet rather than a row of tags (that's BenefitChip's job). */
export function IconStatCard({
  text,
  index,
  palette,
  dark = false,
}: {
  text: string;
  index: number;
  palette: Palette;
  dark?: boolean;
}) {
  const Icon = iconFor(index, text);
  const fg = dark ? "#FFFFFF" : palette.ink;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 14,
        padding: "26px 28px",
        borderRadius: 22,
        width: 420,
        background: dark ? withAlpha("#FFFFFF", 0.1) : withAlpha("#FFFFFF", 0.68),
        border: `1px solid ${dark ? withAlpha("#FFFFFF", 0.18) : withAlpha(palette.ink, 0.08)}`,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 52,
          height: 52,
          borderRadius: "50%",
          background: withAlpha(palette.accent, dark ? 0.3 : 0.2),
        }}
      >
        <Icon color={palette.accent} size={26} strokeWidth={2.25} />
      </div>
      <span
        style={{
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 27,
          color: fg,
          letterSpacing: -0.2,
          lineHeight: 1.15,
        }}
      >
        {text}
      </span>
    </div>
  );
}

export function CtaPill({ text, palette }: { text: string; palette: Palette }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "16px 32px",
        borderRadius: 999,
        background: palette.ink,
      }}
    >
      <span
        style={{
          fontFamily: SANS,
          fontWeight: 700,
          fontSize: 26,
          color: palette.bg,
          letterSpacing: 0.2,
        }}
      >
        {text}
      </span>
      <span style={{ display: "flex", fontFamily: SANS, fontSize: 26, color: palette.bg }}>→</span>
    </div>
  );
}

/**
 * Large soft-focus color blob for organic/lifestyle backgrounds — depth
 * without needing a photographic texture asset. Uses a radial gradient
 * fading to transparent rather than `filter: blur()` — satori/resvg's CSS
 * filter support is inconsistent across versions, but gradients are core and
 * always render, and a radial fade reads as "soft focus" just as well.
 */
export function OrganicBlob({
  color,
  size,
  top,
  left,
  opacity = 0.55,
}: {
  color: string;
  size: number;
  top: number;
  left: number;
  opacity?: number;
}) {
  return (
    <div
      style={{
        position: "absolute",
        width: size,
        height: size,
        top,
        left,
        borderRadius: "50%",
        background: `radial-gradient(circle, ${withAlpha(color, opacity)} 0%, ${withAlpha(color, opacity * 0.4)} 45%, ${withAlpha(color, 0)} 72%)`,
        display: "flex",
      }}
    />
  );
}

/** Bottom brand lockup: wordmark + domain (+ optional handle). A typographic
 *  mark rather than a fetched logo image — always renders, never clashes. */
export function Watermark({
  palette,
  dark = false,
  handle,
}: {
  palette: Palette;
  dark?: boolean;
  handle?: string | null;
}) {
  const fg = dark ? "#FFFFFF" : palette.ink;
  const sub = dark ? withAlpha("#FFFFFF", 0.72) : withAlpha(palette.ink, 0.62);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: 34,
          height: 34,
          borderRadius: 10,
          background: palette.accent,
          fontFamily: SERIF,
          fontWeight: 700,
          fontSize: 20,
          color: "#1B1B1A",
        }}
      >
        N
      </div>
      <span style={{ fontFamily: SANS, fontWeight: 700, fontSize: 24, color: fg, letterSpacing: 0.3 }}>
        NUTRIYET
      </span>
      <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: 22, color: sub }}>
        {handle ? `nutriyet.in · ${handle}` : "nutriyet.in"}
      </span>
    </div>
  );
}

export { withAlpha };
