import { getStoreSettingRow } from "@/lib/store-setting-row";
import { PWA_DEFAULTS, resolvePwa, type PwaSettings } from "@/lib/pwa-config";

export * from "@/lib/pwa-config";

/** Resolved config for the storefront. Falls back to defaults on DB errors. */
export async function getPwaSettings(): Promise<PwaSettings> {
  try {
    const row = await getStoreSettingRow();
    return resolvePwa(row?.pwa);
  } catch {
    return PWA_DEFAULTS;
  }
}
