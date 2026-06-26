import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/config/site";

/** Editable store details, merged with the static config as a fallback. */
export type StoreSettings = {
  // Branding
  siteName: string;
  tagline: string;
  logo: string | null;
  logoDark: string | null;
  favicon: string | null;
  logoHeight: number | null;
  logoHeightMobile: number | null;
  logoMaxWidth: number | null;
  // Theme
  primaryColor: string | null;
  secondaryColor: string | null;
  // Announcement
  announcement: string | null;
  announcementActive: boolean;
  announcementLink: string | null;
  // Contact
  supportEmail: string;
  supportPhone: string;
  whatsapp: string | null;
  address: string | null;
  businessHours: string | null;
  mapsEmbedUrl: string | null;
  // Social
  instagram: string;
  facebook: string;
  twitter: string;
  youtube: string;
  // SEO
  metaTitle: string | null;
  metaDescription: string | null;
  ogImage: string | null;
};

/**
 * Read the single-row store settings, falling back to `config/site.ts` for any
 * unset value so the storefront always has sane defaults. Resilient to a
 * briefly-unreachable DB.
 */
export async function getStoreSettings(): Promise<StoreSettings> {
  let s: Awaited<ReturnType<typeof prisma.storeSetting.findUnique>> = null;
  try {
    s = await prisma.storeSetting.findUnique({ where: { id: "singleton" } });
  } catch {
    /* fall back to config */
  }
  return {
    siteName: s?.siteName || siteConfig.name,
    tagline: s?.tagline || siteConfig.tagline,
    logo: s?.logo ?? null,
    logoDark: s?.logoDark ?? null,
    favicon: s?.favicon ?? null,
    logoHeight: s?.logoHeight ?? null,
    logoHeightMobile: s?.logoHeightMobile ?? null,
    logoMaxWidth: s?.logoMaxWidth ?? null,
    primaryColor: s?.primaryColor ?? null,
    secondaryColor: s?.secondaryColor ?? null,
    announcement: s?.announcement ?? null,
    announcementActive: s?.announcementActive ?? false,
    announcementLink: s?.announcementLink ?? null,
    supportEmail: s?.supportEmail || siteConfig.contact.email,
    supportPhone: s?.supportPhone || siteConfig.contact.phone,
    whatsapp: s?.whatsapp ?? null,
    address: s?.address ?? null,
    businessHours: s?.businessHours ?? null,
    mapsEmbedUrl: s?.mapsEmbedUrl ?? null,
    instagram: s?.instagram || siteConfig.social.instagram,
    facebook: s?.facebook || siteConfig.social.facebook,
    twitter: s?.twitter || siteConfig.social.twitter,
    youtube: s?.youtube || siteConfig.social.youtube,
    metaTitle: s?.metaTitle ?? null,
    metaDescription: s?.metaDescription ?? null,
    ogImage: s?.ogImage ?? null,
  };
}
