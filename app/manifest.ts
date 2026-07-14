import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";
import { getStoreSettings } from "@/lib/queries/settings";
import { cldFavicon } from "@/lib/cld";

// Reflect the current admin favicon (PWA / Android install icon) — no build bake.
export const dynamic = "force-dynamic";

export default async function manifest(): Promise<MetadataRoute.Manifest> {
  const { favicon } = await getStoreSettings();
  // Admin favicon when set (square PNG at the requested size), else the generated
  // brand icon route so the PWA/Android install icon always matches the tab.
  const icon = (size: number, fallback: string) =>
    favicon ? cldFavicon(favicon, size) : fallback;

  return {
    name: `${siteConfig.name} — ${siteConfig.tagline}`,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#00835b",
    orientation: "portrait",
    categories: ["shopping", "food", "health"],
    icons: [
      { src: icon(32, "/brand-icon"), sizes: "32x32", type: "image/png" },
      { src: icon(180, "/brand-apple-icon"), sizes: "180x180", type: "image/png" },
      { src: icon(192, "/brand-apple-icon"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: icon(512, "/brand-apple-icon"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
