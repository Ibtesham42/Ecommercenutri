import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { prisma } from "@/lib/prisma";
import { resolveSeo, type SeoBlob } from "@/lib/seo-settings";
import { isConfigured } from "@/lib/env";
import { SeoManager } from "@/components/admin/seo-manager";
import type { SeoFormValues } from "@/lib/validations/seo";

export const metadata: Metadata = { title: "SEO & Social Share", robots: { index: false } };

const s = (v: string | null | undefined) => v ?? "";

export default async function AdminSeoPage() {
  await guardSection("appearance");

  const row = await prisma.storeSetting.findUnique({ where: { id: "singleton" } });
  const blob = (row?.seo && typeof row.seo === "object" ? row.seo : {}) as SeoBlob;
  const resolved = resolveSeo(row);

  const initial: SeoFormValues = {
    siteName: s(row?.siteName),
    metaTitle: s(row?.metaTitle),
    metaDescription: s(row?.metaDescription),
    ogImage: s(row?.ogImage),
    favicon: s(row?.favicon),
    instagram: s(row?.instagram),
    facebook: s(row?.facebook),
    youtube: s(row?.youtube),
    twitter: s(row?.twitter),
    whatsapp: s(row?.whatsapp),
    brandName: s(blob.brandName),
    shortName: s(blob.shortName),
    keywords: s(blob.keywords),
    siteUrl: s(blob.siteUrl),
    businessCategory: s(blob.businessCategory),
    robotsIndex: blob.robotsIndex !== false,
    locale: s(blob.locale),
    language: s(blob.language),
    publisher: s(blob.publisher),
    author: s(blob.author),
    themeColor: s(blob.themeColor),
    appleTouchIcon: s(blob.appleTouchIcon),
    twitterImage: s(blob.twitterImage),
    ogType: s(blob.ogType) || "website",
    twitterCardType: blob.twitterCardType === "summary" ? "summary" : "summary_large_image",
    shareTitle: s(blob.shareTitle),
    shareDescription: s(blob.shareDescription),
    shareImage: s(blob.shareImage),
    linkedin: s(blob.linkedin),
    pinterest: s(blob.pinterest),
    telegram: s(blob.telegram),
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

  // Reset target: every field blank (so it inherits the config default) except
  // the enum/toggle fields which need a concrete default.
  const blank = Object.fromEntries(
    Object.entries(initial).map(([k, v]) => [k, typeof v === "boolean" ? true : ""]),
  ) as unknown as SeoFormValues;
  const defaults: SeoFormValues = { ...blank, ogType: "website", twitterCardType: "summary_large_image" };

  const fallback = {
    siteName: resolved.siteName,
    title: resolved.title,
    description: resolved.metaDescription,
    shareImage: resolved.shareImage,
    favicon: resolved.favicon,
    domain: resolved.domain,
  };

  return (
    <div className="max-w-6xl">
      <PageHeader
        title="SEO & Social Share Manager"
        description="Control how Nutriyet appears on Google and across every social platform. Live previews update as you type; saving refreshes metadata site-wide — no redeploy needed."
      />
      <SeoManager
        initial={initial}
        defaults={defaults}
        fallback={fallback}
        siteUrl={resolved.siteUrl}
        cloudinaryReady={isConfigured.cloudinary()}
      />
    </div>
  );
}
