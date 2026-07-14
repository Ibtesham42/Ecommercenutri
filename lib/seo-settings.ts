import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/config/site";
import { cldUrl } from "@/lib/cld";

/**
 * Single source of truth for the admin-managed SEO / social-share config.
 *
 * Core fields (siteName, metaTitle, metaDescription, ogImage, favicon and the
 * primary socials) live in their own `StoreSetting` columns and stay editable
 * from the Appearance page; the *extended* SEO fields live in the additive
 * `StoreSetting.seo` JSON blob. `getSeoSettings()` merges both over sensible
 * defaults (derived from `config/site.ts`) so the storefront always has a full,
 * resolved config — even before anything is saved. Nothing here replaces the
 * existing SEO pipeline; it extends it.
 */

/** Raw shape persisted in the `StoreSetting.seo` JSON blob (all optional). */
export type SeoBlob = {
  brandName?: string;
  shortName?: string;
  keywords?: string; // comma-separated
  siteUrl?: string; // canonical base URL
  businessCategory?: string;
  robotsIndex?: boolean;
  locale?: string;
  language?: string;
  publisher?: string;
  author?: string;
  themeColor?: string;
  appleTouchIcon?: string;
  twitterImage?: string;
  ogType?: string;
  twitterCardType?: "summary" | "summary_large_image";
  // Social share overrides
  shareTitle?: string;
  shareDescription?: string;
  shareImage?: string;
  // Extended social links
  linkedin?: string;
  pinterest?: string;
  telegram?: string;
  // Search-engine verification + analytics
  googleVerification?: string;
  bingVerification?: string;
  pinterestVerification?: string;
  yandexVerification?: string;
  facebookAppId?: string;
  twitterCreator?: string;
  gaId?: string;
  gtmId?: string;
  metaPixelId?: string;
};

/** Fully-resolved SEO config (no nulls) — safe to read on server and client. */
export type SeoSettings = {
  siteName: string;
  brandName: string;
  shortName: string;
  title: string; // resolved <title> default
  metaTitle: string; // raw admin value (may be blank)
  tagline: string;
  metaDescription: string;
  keywords: string[];
  siteUrl: string; // canonical base
  domain: string;
  businessCategory: string;
  robotsIndex: boolean;
  locale: string;
  language: string;
  publisher: string;
  author: string;
  themeColor: string;
  // Images (absolute URLs, ready for OG/preview)
  ogImage: string;
  twitterImage: string;
  shareImage: string;
  favicon: string;
  appleTouchIcon: string;
  // Types
  ogType: string;
  twitterCardType: "summary" | "summary_large_image";
  // Social share copy
  shareTitle: string;
  shareDescription: string;
  // Social links
  socials: {
    instagram: string;
    facebook: string;
    youtube: string;
    linkedin: string;
    twitter: string;
    pinterest: string;
    whatsapp: string;
    telegram: string;
  };
  // Search engine + analytics
  googleVerification: string;
  bingVerification: string;
  pinterestVerification: string;
  yandexVerification: string;
  facebookAppId: string;
  twitterCreator: string;
  gaId: string;
  gtmId: string;
  metaPixelId: string;
};

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Make any image URL absolute (needed for OG/Twitter + client previews). */
export function toAbsolute(url: string, base: string): string {
  if (!url) return "";
  if (/^https?:\/\//i.test(url)) return url;
  try {
    return new URL(url, base).toString();
  } catch {
    return url;
  }
}

/**
 * OG types Next.js's metadata API accepts. The OG protocol also defines
 * "product" etc., but Next throws "Invalid OpenGraph type" for them at render
 * time — so any stored value outside this set must degrade to "website".
 */
const NEXT_OG_TYPES = new Set(["website", "article", "book", "profile"]);
export function sanitizeOgType(v: string): string {
  return NEXT_OG_TYPES.has(v) ? v : "website";
}

function splitKeywords(v: string): string[] {
  return v
    .split(",")
    .map((k) => k.trim())
    .filter(Boolean);
}

/**
 * Resolve the merged SEO config. Reads the singleton `StoreSetting` (core
 * columns + `seo` blob) and folds everything over `config/site.ts` defaults.
 * Resilient to a briefly-unreachable DB (falls back to pure config).
 */
export async function getSeoSettings(): Promise<SeoSettings> {
  let row: Awaited<ReturnType<typeof prisma.storeSetting.findUnique>> = null;
  try {
    row = await prisma.storeSetting.findUnique({ where: { id: "singleton" } });
  } catch {
    /* fall back to config */
  }
  return resolveSeo(row);
}

/** Pure resolver (exported so the admin page can resolve without a 2nd query). */
export function resolveSeo(
  row: Awaited<ReturnType<typeof prisma.storeSetting.findUnique>>,
): SeoSettings {
  const blob = (row?.seo && typeof row.seo === "object" ? row.seo : {}) as SeoBlob;

  const siteName = s(row?.siteName) || siteConfig.name;
  const tagline = s(row?.tagline) || siteConfig.tagline;
  const brandName = s(blob.brandName) || siteName;
  const shortName = s(blob.shortName) || siteConfig.name;
  const metaTitle = s(row?.metaTitle);
  const title = metaTitle || `${siteName} — ${tagline}`;
  const metaDescription = s(row?.metaDescription) || siteConfig.description;
  const keywords = blob.keywords ? splitKeywords(blob.keywords) : [...siteConfig.keywords];

  const siteUrl = s(blob.siteUrl) || siteConfig.url;
  let domain: string = siteConfig.domain;
  try {
    domain = new URL(siteUrl).host;
  } catch {
    /* keep config domain */
  }

  const ogImageRaw = s(row?.ogImage) || siteConfig.ogImage;
  const ogImage = toAbsolute(ogImageRaw, siteUrl);
  const shareImage = toAbsolute(s(blob.shareImage) || ogImageRaw, siteUrl);
  const twitterImage = toAbsolute(s(blob.twitterImage) || s(blob.shareImage) || ogImageRaw, siteUrl);
  // Favicon for previews: deliver a real image via Cloudinary when applicable.
  const favicon = s(row?.favicon) ? cldUrl(s(row?.favicon), { w: 64, h: 64 }) : "";
  const appleTouchIcon = toAbsolute(s(blob.appleTouchIcon) || s(row?.favicon), siteUrl);

  const twitterCardType: SeoSettings["twitterCardType"] =
    blob.twitterCardType === "summary" ? "summary" : "summary_large_image";

  return {
    siteName,
    brandName,
    shortName,
    title,
    metaTitle,
    tagline,
    metaDescription,
    keywords,
    siteUrl,
    domain,
    businessCategory: s(blob.businessCategory) || "Health & Nutrition",
    robotsIndex: blob.robotsIndex !== false,
    locale: s(blob.locale) || "en_IN",
    language: s(blob.language) || "en",
    publisher: s(blob.publisher) || siteName,
    author: s(blob.author) || siteName,
    themeColor: s(blob.themeColor) || "#00835b",
    ogImage,
    twitterImage,
    shareImage,
    favicon,
    appleTouchIcon,
    ogType: sanitizeOgType(s(blob.ogType)),
    twitterCardType,
    shareTitle: s(blob.shareTitle) || title,
    shareDescription: s(blob.shareDescription) || metaDescription,
    socials: {
      instagram: s(row?.instagram) || siteConfig.social.instagram,
      facebook: s(row?.facebook) || siteConfig.social.facebook,
      youtube: s(row?.youtube) || siteConfig.social.youtube,
      twitter: s(row?.twitter) || siteConfig.social.twitter,
      whatsapp: s(row?.whatsapp),
      linkedin: s(blob.linkedin),
      pinterest: s(blob.pinterest),
      telegram: s(blob.telegram),
    },
    googleVerification: s(blob.googleVerification),
    bingVerification: s(blob.bingVerification),
    pinterestVerification: s(blob.pinterestVerification),
    yandexVerification: s(blob.yandexVerification),
    facebookAppId: s(blob.facebookAppId),
    twitterCreator: s(blob.twitterCreator),
    gaId: s(blob.gaId),
    gtmId: s(blob.gtmId),
    metaPixelId: s(blob.metaPixelId),
  };
}
