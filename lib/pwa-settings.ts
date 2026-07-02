import { prisma } from "@/lib/prisma";

/**
 * PWA install-prompt configuration — admin-editable copy + display logic,
 * stored in the additive `StoreSetting.pwa` JSON blob (same zero-migration
 * pattern as `seo`). `resolvePwa` folds the blob over defaults so the
 * storefront always receives a complete config.
 */

export type PwaBlob = {
  enabled?: boolean;
  title?: string;
  description?: string;
  installText?: string;
  laterText?: string;
  remindDays?: number;
};

export type PwaSettings = Required<PwaBlob>;

export const PWA_REMIND_OPTIONS = [1, 3, 7, 14, 30] as const;

export const PWA_DEFAULTS: PwaSettings = {
  enabled: true,
  title: "Install Nutriyet App",
  description: "Faster loading, works offline, one tap from your home screen.",
  installText: "Install Now",
  laterText: "Maybe Later",
  remindDays: 3,
};

const s = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Pure fold of a stored blob over defaults (clamps remindDays to the allowed set). */
export function resolvePwa(blob: unknown): PwaSettings {
  const b = (blob && typeof blob === "object" ? blob : {}) as PwaBlob;
  const remind = Number(b.remindDays);
  return {
    enabled: b.enabled !== false,
    title: s(b.title) || PWA_DEFAULTS.title,
    description: s(b.description) || PWA_DEFAULTS.description,
    installText: s(b.installText) || PWA_DEFAULTS.installText,
    laterText: s(b.laterText) || PWA_DEFAULTS.laterText,
    remindDays: (PWA_REMIND_OPTIONS as readonly number[]).includes(remind)
      ? remind
      : PWA_DEFAULTS.remindDays,
  };
}

/** Resolved config for the storefront. Falls back to defaults on DB errors. */
export async function getPwaSettings(): Promise<PwaSettings> {
  try {
    const row = await prisma.storeSetting.findUnique({
      where: { id: "singleton" },
      select: { pwa: true },
    });
    return resolvePwa(row?.pwa);
  } catch {
    return PWA_DEFAULTS;
  }
}
