"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { HOME_SECTIONS, isHomeSectionKey } from "@/lib/home-sections";
import type { AdminResult } from "@/lib/actions/admin/types";

function revalidate() {
  revalidatePath("/admin/homepage");
  revalidatePath("/", "layout");
}

/**
 * Make sure every registry section has a row (idempotent). Called when the admin
 * opens the manager so all sections are toggleable. New rows keep the default
 * registry order so the layout is unchanged until edited.
 */
export async function ensureHomeSections(): Promise<void> {
  try {
    const existing = await prisma.homeSection.findMany({ select: { key: true } });
    const have = new Set(existing.map((r) => r.key));
    const missing = HOME_SECTIONS.map((s, i) => ({ key: s.key, sortOrder: i }))
      .filter((s) => !have.has(s.key));
    if (missing.length) {
      await prisma.homeSection.createMany({ data: missing, skipDuplicates: true });
    }
  } catch {
    /* best-effort */
  }
}

export async function toggleHomeSection(key: string, enabled: boolean): Promise<AdminResult> {
  await requirePermission("appearance");
  if (!isHomeSectionKey(key)) return { ok: false, error: "Unknown section." };

  const idx = HOME_SECTIONS.findIndex((s) => s.key === key);
  await prisma.homeSection.upsert({
    where: { key },
    update: { enabled },
    create: { key, enabled, sortOrder: idx },
  });
  revalidate();
  return { ok: true };
}

/** Persist a new section order from drag-and-drop (keys, top → bottom). */
export async function reorderHomeSections(keys: string[]): Promise<AdminResult> {
  await requirePermission("appearance");
  const valid = keys.filter(isHomeSectionKey);
  if (valid.length === 0) return { ok: true };

  await prisma.$transaction(
    valid.map((key, index) =>
      prisma.homeSection.upsert({
        where: { key },
        update: { sortOrder: index },
        create: { key, sortOrder: index },
      }),
    ),
  );
  revalidate();
  return { ok: true };
}
