"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requirePermission } from "@/lib/auth";
import {
  productInputSchema,
  type ProductInput,
  type VariantInput,
  type ImageInput,
} from "@/lib/validations/admin";
import type { AdminResult, BulkOutcome } from "@/lib/actions/admin/types";

/** Turn the first validation issue into a readable, field-aware message. */
function describeIssue(error: {
  issues: { path: PropertyKey[]; message: string }[];
}): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid product.";
  const [section, index, field] = issue.path;
  const fieldName = typeof field === "string" ? field : undefined;
  // Friendlier copy for the NaN/empty-number case.
  const msg = /expected number/i.test(issue.message)
    ? "enter a valid number"
    : issue.message;
  if (section === "variants" && typeof index === "number") {
    return `Variant ${index + 1}${fieldName ? ` (${fieldName})` : ""}: ${msg}`;
  }
  if (section === "images" && typeof index === "number") {
    return `Image ${index + 1}: ${msg}`;
  }
  return msg;
}

/** Force exactly one default variant (first marked, else the first variant). */
function withSingleDefault(variants: VariantInput[]): VariantInput[] {
  const idx = Math.max(0, variants.findIndex((v) => v.isDefault));
  return variants.map((v, i) => ({ ...v, isDefault: i === idx }));
}

/** Force exactly one main image (first marked, else the first image). */
function withSingleMain(images: ImageInput[]): ImageInput[] {
  if (images.length === 0) return images;
  const idx = Math.max(0, images.findIndex((i) => i.isMain));
  return images.map((img, i) => ({ ...img, isMain: i === idx }));
}

function variantData(v: VariantInput) {
  return {
    weightLabel: v.weightLabel,
    weightInGrams: v.weightInGrams ?? null,
    price: v.price,
    discountPrice: v.discountPrice ?? null,
    stock: v.stock,
    sku: v.sku || null,
    isDefault: v.isDefault,
    isActive: v.isActive,
    images: v.images,
    description: v.description || null,
    barcode: v.barcode || null,
    badge: v.badge || null,
    nutritionImageUrl: v.nutritionImageUrl || null,
  };
}

function imageData(img: ImageInput, sortOrder: number) {
  return {
    url: img.url,
    alt: img.alt || null,
    isMain: img.isMain,
    sortOrder,
  };
}

function revalidateCatalog(slug?: string) {
  revalidatePath("/admin/products");
  revalidatePath("/admin/inventory");
  revalidatePath("/products");
  revalidatePath("/");
  if (slug) revalidatePath(`/products/${slug}`);
}

export async function saveProduct(input: unknown): Promise<AdminResult<{ id: string }>> {
  await requirePermission("products");

  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: describeIssue(parsed.error) };
  }
  const data: ProductInput = parsed.data;
  const variants = withSingleDefault(data.variants);
  const images = withSingleMain(data.images);

  // Slug must be unique across other products.
  const slugClash = await prisma.product.findFirst({
    where: { slug: data.slug, ...(data.id ? { NOT: { id: data.id } } : {}) },
    select: { id: true },
  });
  if (slugClash) return { ok: false, error: "Another product already uses that slug." };

  const scalar = {
    name: data.name,
    slug: data.slug,
    sku: data.sku || null,
    shortDescription: data.shortDescription || null,
    description: data.description,
    benefits: data.benefits || null,
    ingredients: data.ingredients || null,
    categoryId: data.categoryId,
    brandId: data.brandId || null,
    isActive: data.isActive,
    isFeatured: data.isFeatured,
    isBestSeller: data.isBestSeller,
    returnable: data.returnable,
    returnWindowDays: data.returnWindowDays ?? null,
    gstRate: data.gstRate ?? null,
    deliveryCharge: data.deliveryCharge ?? null,
    metaTitle: data.metaTitle || null,
    metaDescription: data.metaDescription || null,
    nutritionFacts:
      data.nutritionFacts.length > 0
        ? (data.nutritionFacts as unknown as Prisma.InputJsonValue)
        : Prisma.JsonNull,
  };

  try {
    if (!data.id) {
      const created = await prisma.product.create({
        data: {
          ...scalar,
          variants: { create: variants.map(variantData) },
          images: { create: images.map((img, i) => imageData(img, i)) },
        },
        select: { id: true, slug: true },
      });
      revalidateCatalog(created.slug);
      return { ok: true, data: { id: created.id } };
    }

    const productId = data.id;
    const keepVariantIds = variants.filter((v) => v.id).map((v) => v.id!);
    const keepImageIds = images.filter((i) => i.id).map((i) => i.id!);

    await prisma.$transaction(async (tx) => {
      await tx.product.update({ where: { id: productId }, data: scalar });

      // Variants: delete removed, update existing, create new.
      await tx.productVariant.deleteMany({
        where: {
          productId,
          ...(keepVariantIds.length ? { id: { notIn: keepVariantIds } } : {}),
        },
      });
      for (const v of variants) {
        if (v.id) {
          await tx.productVariant.update({ where: { id: v.id }, data: variantData(v) });
        } else {
          await tx.productVariant.create({ data: { productId, ...variantData(v) } });
        }
      }

      // Images: delete removed, update existing, create new.
      await tx.productImage.deleteMany({
        where: {
          productId,
          ...(keepImageIds.length ? { id: { notIn: keepImageIds } } : {}),
        },
      });
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img.id) {
          await tx.productImage.update({ where: { id: img.id }, data: imageData(img, i) });
        } else {
          await tx.productImage.create({ data: { productId, ...imageData(img, i) } });
        }
      }
    });

    revalidateCatalog(data.slug);
    return { ok: true, data: { id: productId } };
  } catch (err) {
    console.error("[admin] saveProduct failed:", err);
    return { ok: false, error: "Could not save the product. Please try again." };
  }
}

/** Shopify-style one-click duplicate: copies everything — variants (including
 *  per-variant media), images, pricing, tax/shipping, SEO — as an UNPUBLISHED
 *  draft with a unique "-copy" slug. SKUs are not copied (unique columns); the
 *  admin assigns fresh ones on the copy. */
export async function duplicateProduct(
  id: string,
): Promise<AdminResult<{ id: string }>> {
  await requirePermission("products");
  try {
    const source = await prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { weightInGrams: "asc" } },
        images: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] },
      },
    });
    if (!source) return { ok: false, error: "Product not found." };

    // First free "-copy[-n]" slug.
    const base = `${source.slug}-copy`;
    const taken = new Set(
      (
        await prisma.product.findMany({
          where: { slug: { startsWith: base } },
          select: { slug: true },
        })
      ).map((p) => p.slug),
    );
    let slug = base;
    for (let n = 2; taken.has(slug); n++) slug = `${base}-${n}`;

    const created = await prisma.product.create({
      data: {
        name: `${source.name} (copy)`,
        slug,
        sku: null,
        shortDescription: source.shortDescription,
        description: source.description,
        benefits: source.benefits,
        ingredients: source.ingredients,
        categoryId: source.categoryId,
        brandId: source.brandId,
        isActive: false, // a duplicate never silently goes live
        isFeatured: false,
        isBestSeller: false,
        returnable: source.returnable,
        returnWindowDays: source.returnWindowDays,
        gstRate: source.gstRate,
        deliveryCharge: source.deliveryCharge,
        metaTitle: source.metaTitle,
        metaDescription: source.metaDescription,
        nutritionFacts:
          source.nutritionFacts == null
            ? Prisma.JsonNull
            : (source.nutritionFacts as Prisma.InputJsonValue),
        variants: {
          create: source.variants.map((v) => ({
            weightLabel: v.weightLabel,
            weightInGrams: v.weightInGrams,
            price: v.price,
            discountPrice: v.discountPrice,
            stock: v.stock,
            sku: null,
            isDefault: v.isDefault,
            isActive: v.isActive,
            images: v.images,
            description: v.description,
            barcode: v.barcode,
            badge: v.badge,
            nutritionImageUrl: v.nutritionImageUrl,
          })),
        },
        images: {
          create: source.images.map((im, i) => ({
            url: im.url,
            alt: im.alt,
            isMain: im.isMain,
            sortOrder: i,
          })),
        },
      },
      select: { id: true },
    });

    revalidateCatalog();
    return { ok: true, data: { id: created.id } };
  } catch (err) {
    console.error("[admin] duplicateProduct failed:", err);
    return { ok: false, error: "Could not duplicate the product." };
  }
}

export async function deleteProduct(id: string): Promise<AdminResult> {
  await requirePermission("products");
  try {
    const product = await prisma.product.delete({
      where: { id },
      select: { slug: true },
    });
    revalidateCatalog(product.slug);
    return { ok: true };
  } catch (err) {
    console.error("[admin] deleteProduct failed:", err);
    return { ok: false, error: "Could not delete the product." };
  }
}

type ProductFlag = "isActive" | "isFeatured" | "isBestSeller";

export async function toggleProductFlag(
  id: string,
  flag: ProductFlag,
  value: boolean,
): Promise<AdminResult> {
  await requirePermission("products");
  const product = await prisma.product.update({
    where: { id },
    data: { [flag]: value },
    select: { slug: true },
  });
  revalidateCatalog(product.slug);
  return { ok: true };
}

const PRODUCT_BULK_ACTIONS = ["delete", "activate", "deactivate", "feature", "unfeature"] as const;
type ProductBulkAction = (typeof PRODUCT_BULK_ACTIONS)[number];

/** Bulk operation over selected products. Hard-deletes (orders keep their snapshots)
 *  or flips isActive/isFeatured. Server-authoritative + permission-checked. */
export async function bulkProductAction(
  ids: string[],
  action: ProductBulkAction,
): Promise<AdminResult<BulkOutcome>> {
  await requirePermission("products");
  if (!Array.isArray(ids) || ids.length === 0) return { ok: false, error: "Nothing selected." };
  if (!PRODUCT_BULK_ACTIONS.includes(action)) return { ok: false, error: "Unknown action." };

  try {
    let done = 0;
    if (action === "delete") {
      const res = await prisma.product.deleteMany({ where: { id: { in: ids } } });
      done = res.count;
    } else {
      const data =
        action === "activate"
          ? { isActive: true }
          : action === "deactivate"
            ? { isActive: false }
            : action === "feature"
              ? { isFeatured: true }
              : { isFeatured: false };
      const res = await prisma.product.updateMany({ where: { id: { in: ids } }, data });
      done = res.count;
    }
    revalidateCatalog();
    return { ok: true, data: { done, skipped: ids.length - done } };
  } catch (err) {
    console.error("[admin] bulkProductAction failed:", err);
    return { ok: false, error: "Bulk action failed. Some products may be in use." };
  }
}

/** Inventory quick-edit: set absolute stock for a single variant. */
export async function updateVariantStock(
  variantId: string,
  stock: number,
): Promise<AdminResult> {
  await requirePermission("inventory");
  if (!Number.isInteger(stock) || stock < 0) {
    return { ok: false, error: "Stock must be a non-negative whole number." };
  }
  await prisma.productVariant.update({ where: { id: variantId }, data: { stock } });
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  return { ok: true };
}
