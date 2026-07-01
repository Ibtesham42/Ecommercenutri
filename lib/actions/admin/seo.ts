"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { seoSettingsSchema } from "@/lib/validations/seo";
import { getSeoSettings, type SeoBlob } from "@/lib/seo-settings";
import { absolutize, hostOf, type PreviewData } from "@/lib/seo-preview";
import type { AdminResult } from "@/lib/actions/admin/types";

/** Keep only meaningful values in the JSON blob (drop empty strings). */
function compactBlob(blob: SeoBlob): Prisma.InputJsonValue {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(blob)) {
    if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  }
  return out as Prisma.InputJsonValue;
}

/**
 * Save the SEO & Social-Share settings. Core fields (siteName / metaTitle /
 * metaDescription / ogImage / favicon / primary socials) go to their existing
 * `StoreSetting` columns; the extended SEO/verification/analytics fields go to
 * the `seo` JSON blob. Then revalidate the root layout so the new metadata,
 * Open Graph, Twitter cards, verification tags and analytics take effect
 * immediately — no redeploy required (cache management requirement).
 */
export async function updateSeoSettings(input: unknown): Promise<AdminResult> {
  await requirePermission("appearance");

  const parsed = seoSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid SEO settings." };
  }
  const d = parsed.data;

  const blob: SeoBlob = {
    brandName: d.brandName,
    shortName: d.shortName,
    keywords: d.keywords,
    siteUrl: d.siteUrl,
    businessCategory: d.businessCategory,
    robotsIndex: d.robotsIndex,
    locale: d.locale,
    language: d.language,
    publisher: d.publisher,
    author: d.author,
    themeColor: d.themeColor,
    appleTouchIcon: d.appleTouchIcon,
    twitterImage: d.twitterImage,
    ogType: d.ogType,
    twitterCardType: d.twitterCardType,
    shareTitle: d.shareTitle,
    shareDescription: d.shareDescription,
    shareImage: d.shareImage,
    linkedin: d.linkedin,
    pinterest: d.pinterest,
    telegram: d.telegram,
    googleVerification: d.googleVerification,
    bingVerification: d.bingVerification,
    pinterestVerification: d.pinterestVerification,
    yandexVerification: d.yandexVerification,
    facebookAppId: d.facebookAppId,
    twitterCreator: d.twitterCreator,
    gaId: d.gaId,
    gtmId: d.gtmId,
    metaPixelId: d.metaPixelId,
  };

  const data = {
    siteName: d.siteName || null,
    metaTitle: d.metaTitle || null,
    metaDescription: d.metaDescription || null,
    ogImage: d.ogImage || null,
    favicon: d.favicon || null,
    instagram: d.instagram || null,
    facebook: d.facebook || null,
    youtube: d.youtube || null,
    twitter: d.twitter || null,
    whatsapp: d.whatsapp || null,
    seo: compactBlob(blob),
  };

  await prisma.storeSetting.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  // Refresh every route that inherits the root metadata (title, OG, Twitter,
  // verification, favicon, theme color, analytics) — takes effect immediately.
  revalidatePath("/", "layout");
  revalidatePath("/admin/seo");
  return { ok: true };
}

/** Pull a <meta property|name="key"> content value from raw HTML. */
function metaOf(html: string, key: string, attr: "property" | "name"): string {
  const re = new RegExp(`<meta[^>]+${attr}=["']${key}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  return tag?.match(/content=["']([^"']*)["']/i)?.[1] ?? "";
}

/**
 * URL Tester (bonus): fetch one of the site's OWN pages and return exactly the
 * share preview it will produce — its real <title>, Open Graph and Twitter tags.
 * SSRF-guarded to the configured site origin only. Falls back to the global SEO
 * defaults for any tag a page doesn't set (mirroring Next's metadata inheritance).
 */
export async function fetchUrlPreview(input: unknown): Promise<AdminResult<PreviewData>> {
  await requirePermission("appearance");
  const raw = typeof input === "string" ? input.trim() : "";
  if (!raw) return { ok: false, error: "Enter a page URL or path." };

  const seo = await getSeoSettings();
  const base = seo.siteUrl;
  let target: URL;
  try {
    target = new URL(raw, base);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL or path." };
  }
  // Only allow fetching this site's own pages (no SSRF to arbitrary hosts).
  if (hostOf(target.toString()) !== hostOf(base)) {
    return { ok: false, error: `You can only test pages on ${hostOf(base)}.` };
  }

  let html = "";
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 7000);
    const res = await fetch(target.toString(), {
      signal: ctrl.signal,
      headers: { "user-agent": "NutriyetSEOBot/1.0" },
      cache: "no-store",
    });
    clearTimeout(t);
    if (!res.ok) return { ok: false, error: `The page returned HTTP ${res.status}.` };
    html = await res.text();
  } catch {
    return { ok: false, error: "Couldn't reach that page. Is it deployed and public?" };
  }

  const titleTag = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim() ?? "";
  const ogTitle = metaOf(html, "og:title", "property");
  const ogDesc = metaOf(html, "og:description", "property");
  const ogImage = metaOf(html, "og:image", "property");
  const twImage = metaOf(html, "twitter:image", "name");
  const twCard = metaOf(html, "twitter:card", "name");
  const desc = metaOf(html, "description", "name");

  const image = absolutize(ogImage || twImage || "", base) || seo.shareImage;

  const data: PreviewData = {
    title: ogTitle || titleTag || seo.shareTitle,
    description: ogDesc || desc || seo.shareDescription,
    image,
    siteName: metaOf(html, "og:site_name", "property") || seo.siteName,
    domain: hostOf(base),
    url: target.toString(),
    favicon: seo.favicon,
    twitterCard: twCard === "summary" ? "summary" : "summary_large_image",
  };
  return { ok: true, data };
}
