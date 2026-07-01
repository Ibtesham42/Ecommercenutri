import { z } from "zod";

// Generous hard caps (the UI shows soft "ideal length" warnings well below these).
const str = (max: number) => z.string().max(max).optional().default("");

/**
 * Full SEO & Social-Share form. Core fields map to existing `StoreSetting`
 * columns; the rest are folded into the `StoreSetting.seo` JSON blob by the
 * action. Everything is optional — blanks inherit the config-derived defaults.
 */
export const seoSettingsSchema = z.object({
  // --- Core (→ StoreSetting columns) ---
  siteName: str(80),
  metaTitle: str(120),
  metaDescription: str(320),
  ogImage: str(600),
  favicon: str(600),
  instagram: str(200),
  facebook: str(200),
  youtube: str(200),
  twitter: str(200),
  whatsapp: str(40),
  // --- Extended global SEO (→ seo blob) ---
  brandName: str(80),
  shortName: str(40),
  keywords: str(600),
  siteUrl: str(200),
  businessCategory: str(80),
  robotsIndex: z.boolean().optional().default(true),
  locale: str(12),
  language: str(12),
  publisher: str(120),
  author: str(120),
  themeColor: str(24),
  appleTouchIcon: str(600),
  twitterImage: str(600),
  ogType: str(40),
  twitterCardType: z.enum(["summary", "summary_large_image"]).optional().default("summary_large_image"),
  // --- Social share ---
  shareTitle: str(120),
  shareDescription: str(320),
  shareImage: str(600),
  // --- Extended social links ---
  linkedin: str(200),
  pinterest: str(200),
  telegram: str(200),
  // --- Search engine verification + analytics ---
  googleVerification: str(200),
  bingVerification: str(200),
  pinterestVerification: str(200),
  yandexVerification: str(200),
  facebookAppId: str(40),
  twitterCreator: str(40),
  gaId: str(40),
  gtmId: str(40),
  metaPixelId: str(40),
});

export type SeoFormValues = z.infer<typeof seoSettingsSchema>;
