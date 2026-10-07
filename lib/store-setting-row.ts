import { Prisma, type StoreSetting } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withDbRetry } from "@/lib/db-retry";
import { CACHE_TAGS, cachedQuery } from "@/lib/cache";

/** The singleton row minus its only DateTime (it'd round-trip the cache as a string). */
export type StoreSettingRow = Omit<StoreSetting, "updatedAt">;

/**
 * One cached read of the StoreSetting singleton for the storefront. A single
 * page used to hit this row ~5 times per request (store/pricing/growth/PWA/SEO
 * getters); they all share this now. Throws on a DB error (never cached) so
 * each getter keeps its own config-default fallback. Admin pages/actions read
 * the row directly and stay live. Invalidated on any StoreSetting write.
 */
export const getStoreSettingRow = cachedQuery<StoreSettingRow | null>(
  async () => {
    const row = await withDbRetry(() => prisma.storeSetting.findUnique({ where: { id: "singleton" } }));
    if (!row) return null;
    const { updatedAt, ...rest } = row;
    void updatedAt; // dropped on purpose — see StoreSettingRow
    return rest;
  },
  // Full-row read: key on the generated column list so a migration that adds
  // a column can't be served the pre-migration shape from the data cache.
  `store-setting-row:${Object.keys(Prisma.StoreSettingScalarFieldEnum).join(",")}`,
  [CACHE_TAGS.storeSettings],
);
