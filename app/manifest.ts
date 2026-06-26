import type { MetadataRoute } from "next";
import { siteConfig } from "@/config/site";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${siteConfig.name} — ${siteConfig.tagline}`,
    short_name: siteConfig.name,
    description: siteConfig.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#16803c",
    orientation: "portrait",
    categories: ["shopping", "food", "health"],
    icons: [
      { src: "/brand-icon", sizes: "32x32", type: "image/png" },
      { src: "/brand-apple-icon", sizes: "180x180", type: "image/png" },
      // Reuse the brand routes as larger any/maskable icon sources.
      { src: "/brand-apple-icon", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand-apple-icon", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
