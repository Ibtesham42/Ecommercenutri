"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireAdmin, requirePermission } from "@/lib/auth";
import {
  ownEmailSchema,
  ownPasswordSchema,
  storeSettingsSchema,
} from "@/lib/validations/admin";
import type { AdminResult } from "@/lib/actions/admin/types";

// --- Current admin's own credentials (any admin may manage their own) -------

export async function updateOwnEmail(input: unknown): Promise<AdminResult> {
  const me = await requireAdmin();

  const parsed = ownEmailSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid email." };
  }
  const email = parsed.data.email.toLowerCase().trim();

  const clash = await prisma.user.findFirst({
    where: { email, NOT: { id: me.id } },
    select: { id: true },
  });
  if (clash) return { ok: false, error: "That email is already in use." };

  await prisma.user.update({
    where: { id: me.id },
    data: { email, emailVerified: new Date() },
  });
  revalidatePath("/admin/settings");
  return { ok: true };
}

export async function updateOwnPassword(input: unknown): Promise<AdminResult> {
  const me = await requireAdmin();

  const parsed = ownPasswordSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid password." };
  }

  const user = await prisma.user.findUnique({
    where: { id: me.id },
    select: { passwordHash: true },
  });
  if (!user?.passwordHash) {
    return { ok: false, error: "No password is set on this account." };
  }
  const valid = await bcrypt.compare(parsed.data.currentPassword, user.passwordHash);
  if (!valid) return { ok: false, error: "Your current password is incorrect." };

  await prisma.user.update({
    where: { id: me.id },
    data: { passwordHash: await bcrypt.hash(parsed.data.newPassword, 10) },
  });
  return { ok: true };
}

// --- Store / appearance settings (appearance permission) --------------------

export async function updateStoreSettings(input: unknown): Promise<AdminResult> {
  await requirePermission("appearance");

  const parsed = storeSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid settings." };
  }
  const d = parsed.data;

  const data = {
    siteName: d.siteName || null,
    tagline: d.tagline || null,
    logo: d.logo || null,
    logoDark: d.logoDark || null,
    favicon: d.favicon || null,
    logoHeight: d.logoHeight ?? null,
    logoHeightMobile: d.logoHeightMobile ?? null,
    logoMaxWidth: d.logoMaxWidth ?? null,
    primaryColor: d.primaryColor || null,
    secondaryColor: d.secondaryColor || null,
    announcement: d.announcement || null,
    announcementActive: d.announcementActive,
    announcementLink: d.announcementLink || null,
    supportEmail: d.supportEmail || null,
    supportPhone: d.supportPhone || null,
    whatsapp: d.whatsapp || null,
    address: d.address || null,
    businessHours: d.businessHours || null,
    mapsEmbedUrl: d.mapsEmbedUrl || null,
    instagram: d.instagram || null,
    facebook: d.facebook || null,
    twitter: d.twitter || null,
    youtube: d.youtube || null,
    metaTitle: d.metaTitle || null,
    metaDescription: d.metaDescription || null,
    ogImage: d.ogImage || null,
  };

  await prisma.storeSetting.upsert({
    where: { id: "singleton" },
    update: data,
    create: { id: "singleton", ...data },
  });

  revalidatePath("/admin/appearance");
  revalidatePath("/", "layout"); // header/footer/announcement read store settings
  return { ok: true };
}
