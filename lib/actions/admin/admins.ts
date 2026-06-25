"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { requireSuperAdmin } from "@/lib/auth";
import { sanitizePermissions } from "@/lib/permissions";
import { adminCreateSchema, adminUpdateSchema } from "@/lib/validations/admin";
import type { AdminResult } from "@/lib/actions/admin/types";

/** Create a sub-admin (role ADMIN) with a set of section permissions. */
export async function createAdmin(input: unknown): Promise<AdminResult> {
  await requireSuperAdmin();

  const parsed = adminCreateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }
  const d = parsed.data;
  const email = d.email.toLowerCase().trim();

  const existing = await prisma.user.findUnique({ where: { email }, select: { id: true } });
  if (existing) return { ok: false, error: "A user with that email already exists." };

  await prisma.user.create({
    data: {
      name: d.name,
      email,
      passwordHash: await bcrypt.hash(d.password, 10),
      phone: d.phone || null,
      contactEmail: d.contactEmail || null,
      address: d.address || null,
      image: d.image || null,
      role: "ADMIN",
      permissions: sanitizePermissions(d.permissions),
      emailVerified: new Date(), // admin-created, trusted
      isActive: true,
    },
  });

  revalidatePath("/admin/admins");
  return { ok: true };
}

/** Update a sub-admin's details/permissions. Super admins are not edited here. */
export async function updateAdmin(input: unknown): Promise<AdminResult> {
  const me = await requireSuperAdmin();

  const parsed = adminUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid details." };
  }
  const d = parsed.data;

  const target = await prisma.user.findUnique({
    where: { id: d.id },
    select: { id: true, role: true },
  });
  if (!target || target.role !== "ADMIN") {
    return { ok: false, error: "Sub-admin not found." };
  }
  if (target.id === me.id) {
    return { ok: false, error: "Edit your own account from Settings." };
  }

  await prisma.user.update({
    where: { id: d.id },
    data: {
      name: d.name,
      phone: d.phone || null,
      contactEmail: d.contactEmail || null,
      address: d.address || null,
      image: d.image || null,
      permissions: sanitizePermissions(d.permissions),
      ...(d.password ? { passwordHash: await bcrypt.hash(d.password, 10) } : {}),
    },
  });

  revalidatePath("/admin/admins");
  return { ok: true };
}

/** Activate or deactivate a sub-admin (deactivated admins can't sign in). */
export async function setAdminActive(id: string, isActive: boolean): Promise<AdminResult> {
  const me = await requireSuperAdmin();
  if (id === me.id) return { ok: false, error: "You can't deactivate your own account." };

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target || target.role !== "ADMIN") {
    return { ok: false, error: "Sub-admin not found." };
  }

  await prisma.user.update({ where: { id }, data: { isActive } });
  revalidatePath("/admin/admins");
  return { ok: true };
}

/** Permanently delete a sub-admin. Cannot delete self or a super admin. */
export async function deleteAdmin(id: string): Promise<AdminResult> {
  const me = await requireSuperAdmin();
  if (id === me.id) return { ok: false, error: "You can't delete your own account." };

  const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
  if (!target) return { ok: false, error: "Account not found." };
  if (target.role === "SUPER_ADMIN") {
    return { ok: false, error: "Super admins can't be deleted here." };
  }
  if (target.role !== "ADMIN") {
    return { ok: false, error: "Only sub-admins can be removed here." };
  }

  await prisma.user.delete({ where: { id } });
  revalidatePath("/admin/admins");
  return { ok: true };
}
