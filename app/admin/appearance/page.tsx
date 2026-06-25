import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import {
  AppearanceForm,
  type AppearanceValues,
} from "@/components/admin/appearance-form";
import { getStoreSettings } from "@/lib/queries/settings";
import { isConfigured } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "Appearance", robots: { index: false } };

const s = (v: string | null | undefined) => v ?? "";

export default async function AdminAppearancePage() {
  await guardSection("appearance");

  // Read the raw row (not the config-merged view) so blank fields show as blank
  // and only get the config fallback on the storefront.
  const [store, raw] = await Promise.all([
    getStoreSettings(),
    prisma.storeSetting.findUnique({ where: { id: "singleton" } }),
  ]);

  const initial: AppearanceValues = {
    siteName: s(raw?.siteName),
    tagline: s(raw?.tagline),
    logo: s(raw?.logo),
    logoDark: s(raw?.logoDark),
    favicon: s(raw?.favicon),
    primaryColor: s(raw?.primaryColor),
    secondaryColor: s(raw?.secondaryColor),
    announcement: s(raw?.announcement),
    announcementActive: raw?.announcementActive ?? false,
    announcementLink: s(raw?.announcementLink),
    supportEmail: s(raw?.supportEmail),
    supportPhone: s(raw?.supportPhone),
    whatsapp: s(raw?.whatsapp),
    address: s(raw?.address),
    businessHours: s(raw?.businessHours),
    mapsEmbedUrl: s(raw?.mapsEmbedUrl),
    instagram: s(raw?.instagram),
    facebook: s(raw?.facebook),
    twitter: s(raw?.twitter),
    youtube: s(raw?.youtube),
    metaTitle: s(raw?.metaTitle),
    metaDescription: s(raw?.metaDescription),
    ogImage: s(raw?.ogImage),
  };

  return (
    <div className="max-w-4xl">
      <PageHeader
        title="Appearance"
        description={`Branding, colors, announcement bar, contact and SEO for ${store.siteName}. Blank fields fall back to defaults.`}
      />
      <AppearanceForm initial={initial} cloudinaryReady={isConfigured.cloudinary()} />
    </div>
  );
}
