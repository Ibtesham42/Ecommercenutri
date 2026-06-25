"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { categoryInputSchema } from "@/lib/validations/admin";
import type { AdminResult } from "@/lib/actions/admin/types";

function revalidate() {
  revalidatePath("/admin/categories");
  revalidatePath("/categories");
  revalidatePath("/");
}

export async function saveCategory(input: unknown): Promise<AdminResult> {
  await requirePermission("categories");

  const parsed = categoryInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid category." };
  }
  const d = parsed.data;

  if (d.id && d.parentId === d.id) {
    return { ok: false, error: "A category can't be its own parent." };
  }

  const clash = await prisma.category.findFirst({
    where: { slug: d.slug, ...(d.id ? { NOT: { id: d.id } } : {}) },
    select: { id: true },
  });
  if (clash) return { ok: false, error: "Another category already uses that slug." };

  const data = {
    name: d.name,
    slug: d.slug,
    description: d.description || null,
    image: d.image || null,
    parentId: d.parentId || null,
    sortOrder: d.sortOrder,
    isActive: d.isActive,
    metaTitle: d.metaTitle || null,
    metaDescription: d.metaDescription || null,
  };

  if (d.id) {
    await prisma.category.update({ where: { id: d.id }, data });
  } else {
    await prisma.category.create({ data });
  }
  revalidate();
  return { ok: true };
}

export async function deleteCategory(id: string): Promise<AdminResult> {
  await requirePermission("categories");
  const count = await prisma.product.count({ where: { categoryId: id } });
  if (count > 0) {
    return {
      ok: false,
      error: `Move or delete the ${count} product${count === 1 ? "" : "s"} in this category first.`,
    };
  }
  try {
    await prisma.category.delete({ where: { id } });
    revalidate();
    return { ok: true };
  } catch (err) {
    console.error("[admin] deleteCategory failed:", err);
    return { ok: false, error: "Could not delete the category." };
  }
}
