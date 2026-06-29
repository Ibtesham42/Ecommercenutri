"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { sanitizeRichText } from "@/lib/sanitize";
import { contentPageSchema } from "@/lib/validations/admin";
import { isLegalSlug } from "@/lib/legal-content";
import type { AdminResult } from "@/lib/actions/admin/types";

function revalidate(slug: string) {
  revalidatePath("/admin/legal");
  revalidatePath(`/${slug}`);
}

/** Override a legal/policy page with custom HTML (sanitized). Upserts a ContentPage. */
export async function saveContentPage(input: unknown): Promise<AdminResult> {
  await requirePermission("appearance");
  const parsed = contentPageSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid page." };
  const { slug, title, body } = parsed.data;

  const data = { title, body: sanitizeRichText(body) };
  await prisma.contentPage.upsert({
    where: { slug },
    update: data,
    create: { slug, ...data },
  });
  revalidate(slug);
  return { ok: true };
}

/** Reset a legal page back to the built-in default (deletes the override row). */
export async function resetContentPage(slug: string): Promise<AdminResult> {
  await requirePermission("appearance");
  if (!isLegalSlug(slug)) return { ok: false, error: "Unknown page." };
  await prisma.contentPage.deleteMany({ where: { slug } });
  revalidate(slug);
  return { ok: true };
}
