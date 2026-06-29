"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import { categoryInputSchema } from "@/lib/validations/admin";
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";

function revalidate() {
  revalidatePath("/admin/categories");
  revalidatePath("/categories");
  revalidatePath("/");
}

const CATEGORY_BULK_ACTIONS = ["delete", "activate", "deactivate"] as const;
type CategoryBulkAction = (typeof CATEGORY_BULK_ACTIONS)[number];

/** Bulk category action. Delete is safe: categories that still hold products are
 *  skipped (delete the products or move them first), the rest are removed. */
export async function bulkCategoryAction(
  ids: string[],
  action: CategoryBulkAction,
): Promise<AdminResult<BulkOutcome>> {
  await requirePermission("categories");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." };
  if (!CATEGORY_BULK_ACTIONS.includes(action)) return { ok: false, error: "Unknown action." };

  try {
    if (action === "delete") {
      const withProducts = await prisma.category.findMany({
        where: { id: { in: ids }, products: { some: {} } },
        select: { id: true },
      });
      const blocked = new Set(withProducts.map((c) => c.id));
      const deletable = ids.filter((id) => !blocked.has(id));
      let done = 0;
      if (deletable.length) {
        done = (await prisma.category.deleteMany({ where: { id: { in: deletable } } })).count;
      }
      revalidate();
      const skipped = ids.length - done;
      return {
        ok: true,
        data: {
          done,
          skipped,
          note: skipped
            ? `${done} deleted · ${skipped} kept (still have products).`
            : undefined,
        },
      };
    }

    const res = await prisma.category.updateMany({
      where: { id: { in: ids } },
      data: { isActive: action === "activate" },
    });
    revalidate();
    return { ok: true, data: { done: res.count, skipped: ids.length - res.count } };
  } catch (err) {
    console.error("[admin] bulkCategoryAction failed:", err);
    return { ok: false, error: "Bulk action failed." };
  }
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
    returnable: d.returnable,
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
