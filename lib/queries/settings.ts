import { prisma } from "@/lib/prisma";
import { siteConfig } from "@/config/site";

/** Editable store details, merged with the static config as a fallback. */
export type StoreSettings = {
  supportEmail: string;
  supportPhone: string;
  address: string | null;
  announcement: string | null;
  instagram: string;
  facebook: string;
  twitter: string;
  youtube: string;
};

/**
 * Read the single-row store settings, falling back to `config/site.ts` for any
 * unset value so the storefront always has sane contact details. Resilient to a
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
    supportEmail: s?.supportEmail || siteConfig.contact.email,
    supportPhone: s?.supportPhone || siteConfig.contact.phone,
    address: s?.address ?? null,
    announcement: s?.announcement ?? null,
    instagram: s?.instagram || siteConfig.social.instagram,
    facebook: s?.facebook || siteConfig.social.facebook,
    twitter: s?.twitter || siteConfig.social.twitter,
    youtube: s?.youtube || siteConfig.social.youtube,
  };
}
