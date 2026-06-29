import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/config/site";
import { PRICING_DEFAULTS, type PricingSettings } from "@/lib/pricing";

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
  // Pricing & tax
  defaultGstRate: number;
  gstin: string | null;
  // Shipping & delivery
  defaultShippingFee: number;
  freeShippingThreshold: number;
  freeShippingEnabled: boolean;
  localDeliveryFee: number | null;
  expressDeliveryFee: number | null;
  // Cash on Delivery
  codFee: number | null;
  codEnabled: boolean;
  codMinOrder: number | null;
  codMaxOrder: number | null;
  codPincodes: string[];
  // Returns & refunds
  returnsEnabled: boolean;
  returnWindowDays: number;
  // Affiliate program
  affiliateEnabled: boolean;
  affiliateCookieDays: number;
  affiliateDefaultCommissionType: "PERCENT" | "FIXED";
  affiliateDefaultCommissionValue: number;
  affiliateMinPayout: number;
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
    defaultGstRate: s?.defaultGstRate ?? PRICING_DEFAULTS.defaultGstRate,
    gstin: s?.gstin ?? null,
    defaultShippingFee: s?.defaultShippingFee ?? PRICING_DEFAULTS.defaultShippingFee,
    freeShippingThreshold:
      s?.freeShippingThreshold ?? PRICING_DEFAULTS.freeShippingThreshold,
    freeShippingEnabled: s?.freeShippingEnabled ?? PRICING_DEFAULTS.freeShippingEnabled,
    localDeliveryFee: s?.localDeliveryFee ?? null,
    expressDeliveryFee: s?.expressDeliveryFee ?? null,
    codFee: s?.codFee ?? null,
    codEnabled: s?.codEnabled ?? false,
    codMinOrder: s?.codMinOrder ?? null,
    codMaxOrder: s?.codMaxOrder ?? null,
    codPincodes: s?.codPincodes ?? [],
    returnsEnabled: s?.returnsEnabled ?? true,
    returnWindowDays: s?.returnWindowDays ?? 7,
    affiliateEnabled: s?.affiliateEnabled ?? true,
    affiliateCookieDays: s?.affiliateCookieDays ?? 30,
    affiliateDefaultCommissionType: s?.affiliateDefaultCommissionType ?? "PERCENT",
    affiliateDefaultCommissionValue: s?.affiliateDefaultCommissionValue ?? 10,
    affiliateMinPayout: s?.affiliateMinPayout ?? 50000,
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

/**
 * Just the pricing/tax settings (GST + shipping defaults), for the cart and
 * checkout where the full store settings aren't needed. Falls back to the
 * built-in defaults if the DB is briefly unreachable.
 */
export async function getPricingSettings(): Promise<PricingSettings> {
  try {
    const s = await prisma.storeSetting.findUnique({
      where: { id: "singleton" },
      select: {
        defaultGstRate: true,
        defaultShippingFee: true,
        freeShippingThreshold: true,
        freeShippingEnabled: true,
      },
    });
    if (!s) return PRICING_DEFAULTS;
    return {
      defaultGstRate: s.defaultGstRate,
      defaultShippingFee: s.defaultShippingFee,
      freeShippingThreshold: s.freeShippingThreshold,
      freeShippingEnabled: s.freeShippingEnabled,
    };
  } catch {
    return PRICING_DEFAULTS;
  }
}

export type CodSettings = {
  codEnabled: boolean;
  codFee: number; // paise (0 when unset)
  codMinOrder: number | null; // paise
  codMaxOrder: number | null; // paise
  codPincodes: string[];
};

const COD_DEFAULTS: CodSettings = {
  codEnabled: false,
  codFee: 0,
  codMinOrder: null,
  codMaxOrder: null,
  codPincodes: [],
};

export type AffiliateSettings = {
  affiliateEnabled: boolean;
  affiliateCookieDays: number;
  affiliateDefaultCommissionType: "PERCENT" | "FIXED";
  affiliateDefaultCommissionValue: number;
  affiliateMinPayout: number;
};

const AFFILIATE_DEFAULTS: AffiliateSettings = {
  affiliateEnabled: true,
  affiliateCookieDays: 30,
  affiliateDefaultCommissionType: "PERCENT",
  affiliateDefaultCommissionValue: 10,
  affiliateMinPayout: 50000,
};

/** Affiliate-program settings. Falls back to defaults on DB error. */
export async function getAffiliateSettings(): Promise<AffiliateSettings> {
  try {
    const s = await prisma.storeSetting.findUnique({
      where: { id: "singleton" },
      select: {
        affiliateEnabled: true,
        affiliateCookieDays: true,
        affiliateDefaultCommissionType: true,
        affiliateDefaultCommissionValue: true,
        affiliateMinPayout: true,
      },
    });
    if (!s) return AFFILIATE_DEFAULTS;
    return {
      affiliateEnabled: s.affiliateEnabled,
      affiliateCookieDays: s.affiliateCookieDays,
      affiliateDefaultCommissionType: s.affiliateDefaultCommissionType,
      affiliateDefaultCommissionValue: s.affiliateDefaultCommissionValue,
      affiliateMinPayout: s.affiliateMinPayout,
    };
  } catch {
    return AFFILIATE_DEFAULTS;
  }
}

export type ReturnSettings = { returnsEnabled: boolean; returnWindowDays: number };

const RETURN_DEFAULTS: ReturnSettings = { returnsEnabled: true, returnWindowDays: 7 };

/** Returns/refund policy settings. Falls back to defaults on DB error. */
export async function getReturnSettings(): Promise<ReturnSettings> {
  try {
    const s = await prisma.storeSetting.findUnique({
      where: { id: "singleton" },
      select: { returnsEnabled: true, returnWindowDays: true },
    });
    if (!s) return RETURN_DEFAULTS;
    return { returnsEnabled: s.returnsEnabled, returnWindowDays: s.returnWindowDays };
  } catch {
    return RETURN_DEFAULTS;
  }
}

/** Cash-on-Delivery settings for checkout. COD is off (unavailable) on DB error. */
export async function getCodSettings(): Promise<CodSettings> {
  try {
    const s = await prisma.storeSetting.findUnique({
      where: { id: "singleton" },
      select: {
        codEnabled: true,
        codFee: true,
        codMinOrder: true,
        codMaxOrder: true,
        codPincodes: true,
      },
    });
    if (!s) return COD_DEFAULTS;
    return {
      codEnabled: s.codEnabled,
      codFee: s.codFee ?? 0,
      codMinOrder: s.codMinOrder,
      codMaxOrder: s.codMaxOrder,
      codPincodes: s.codPincodes,
    };
  } catch {
    return COD_DEFAULTS;
  }
}
