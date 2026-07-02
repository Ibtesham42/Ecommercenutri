"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { pwaSettingsSchema } from "@/lib/validations/admin";
import type { PwaBlob } from "@/lib/pwa-settings";
import type { AdminResult } from "@/lib/actions/admin/types";

/** Keep booleans, finite numbers and non-empty strings (the seo compactBlob
 *  drops numbers — that would silently lose remindDays). */
function compactPwaBlob(blob: PwaBlob): Prisma.InputJsonValue {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(blob)) {
    if (typeof v === "boolean") out[k] = v;
    else if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
    else if (typeof v === "string" && v.trim() !== "") out[k] = v.trim();
  }
  return out as Prisma.InputJsonValue;
}

/**
 * Save the PWA install-prompt settings (Admin → Appearance). Revalidates the
 * root layout so the storefront picks up new copy without a redeploy.
 */
export async function updatePwaSettings(input: unknown): Promise<AdminResult> {
  await requirePermission("appearance");

  const parsed = pwaSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  }

  const blob = compactPwaBlob(parsed.data);
  await prisma.storeSetting.upsert({
    where: { id: "singleton" },
    update: { pwa: blob },
    create: { id: "singleton", pwa: blob },
  });

  revalidatePath("/", "layout");
  revalidatePath("/admin/appearance");
  return { ok: true };
}
