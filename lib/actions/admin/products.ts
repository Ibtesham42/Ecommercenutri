"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/auth";
import {
  productInputSchema,
  type ProductInput,
  type VariantInput,
  type ImageInput,
} from "@/lib/validations/admin";
import type { AdminResult } from "@/lib/actions/admin/types";

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
  await requireAdmin();

  const parsed = productInputSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid product." };
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

export async function deleteProduct(id: string): Promise<AdminResult> {
  await requireAdmin();
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
  await requireAdmin();
  const product = await prisma.product.update({
    where: { id },
    data: { [flag]: value },
    select: { slug: true },
  });
  revalidateCatalog(product.slug);
  return { ok: true };
}

/** Inventory quick-edit: set absolute stock for a single variant. */
export async function updateVariantStock(
  variantId: string,
  stock: number,
): Promise<AdminResult> {
  await requireAdmin();
  if (!Number.isInteger(stock) || stock < 0) {
    return { ok: false, error: "Stock must be a non-negative whole number." };
  }
  await prisma.productVariant.update({ where: { id: variantId }, data: { stock } });
  revalidatePath("/admin/inventory");
  revalidatePath("/admin/products");
  return { ok: true };
}
