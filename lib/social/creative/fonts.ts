import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

/**
 * Static (non-variable) font files for the satori/@vercel/og creative renderer.
 *
 * Cloudinary's URL-transform text layers (the old engine) could not use the
 * site's real brand faces — Fraunces isn't supported there, and neither is
 * Inter. Rendering with `next/og` removes that ceiling entirely, so the
 * creative engine uses the ACTUAL brand pair (Fraunces serif + Hanken Grotesk
 * sans, matching app/layout.tsx) instead of the Playfair/Montserrat stand-ins.
 *
 * satori needs real font bytes (ttf/otf/woff — not woff2, and not a variable
 * font), so these are static WOFF instances downloaded once and committed
 * here rather than fetched at request time (no runtime network dependency,
 * no risk of a slow/failed font fetch inside the publish path).
 */

const FONT_DIR = path.join(process.cwd(), "lib/social/fonts");

export type LoadedFont = {
  name: string;
  data: Buffer;
  weight: 400 | 500 | 600 | 700;
  style: "normal";
};

let cache: LoadedFont[] | null = null;

export function loadCreativeFonts(): LoadedFont[] {
  if (cache) return cache;
  const read = (file: string) => readFileSync(path.join(FONT_DIR, file));
  cache = [
    { name: "Fraunces", data: read("Fraunces-Regular.woff"), weight: 400, style: "normal" },
    { name: "Fraunces", data: read("Fraunces-SemiBold.woff"), weight: 600, style: "normal" },
    { name: "Fraunces", data: read("Fraunces-Bold.woff"), weight: 700, style: "normal" },
    { name: "Hanken Grotesk", data: read("HankenGrotesk-Regular.woff"), weight: 400, style: "normal" },
    { name: "Hanken Grotesk", data: read("HankenGrotesk-Medium.woff"), weight: 500, style: "normal" },
    { name: "Hanken Grotesk", data: read("HankenGrotesk-SemiBold.woff"), weight: 600, style: "normal" },
    { name: "Hanken Grotesk", data: read("HankenGrotesk-Bold.woff"), weight: 700, style: "normal" },
  ];
  return cache;
}

export const SERIF = "Fraunces";
export const SANS = "Hanken Grotesk";
