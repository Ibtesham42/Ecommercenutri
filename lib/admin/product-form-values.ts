import { paiseToRupees } from "@/lib/format";

/**
 * Shape of the admin product form. Lives in a plain (non-"use client") module so
 * `productToFormValues` can be called from the Server Component edit page —
 * calling a function exported from a client module on the server throws in a
 * production build.
 */
export type ProductFormValues = {
  id?: string;
  name: string;
  slug: string;
  sku?: string;
  shortDescription?: string;
  description: string;
  benefits?: string;
  ingredients?: string;
  categoryId: string;
  brandId?: string;
  isActive: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  returnable: boolean; // eligible for returns
  returnWindowDays?: number | null; // override; null/blank = store default
  gstRate?: number | null; // percent; null/blank = store default
  deliveryRupees?: number | null; // rupees; null/blank = store default
  metaTitle?: string;
  metaDescription?: string;
  nutritionFacts: { label: string; value: string }[];
  variants: {
    id?: string;
    weightLabel: string;
    weightInGrams?: number | null;
    priceRupees: number;
    discountRupees?: number | null;
    stock: number;
    sku?: string;
    isActive: boolean;
    isDefault: boolean;
  }[];
  images: { id?: string; url: string; alt?: string; isMain: boolean }[];
};

/** Build form defaults from a persisted product (paise → rupees). */
export function productToFormValues(p: {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  shortDescription: string | null;
  description: string;
  benefits: string | null;
  ingredients: string | null;
  categoryId: string;
  brandId: string | null;
  isActive: boolean;
  isFeatured: boolean;
  isBestSeller: boolean;
  returnable: boolean;
  returnWindowDays: number | null;
  gstRate: number | null;
  deliveryCharge: number | null;
  metaTitle: string | null;
  metaDescription: string | null;
  nutritionFacts: unknown;
  variants: {
    id: string;
    weightLabel: string;
    weightInGrams: number | null;
    price: number;
    discountPrice: number | null;
    stock: number;
    sku: string | null;
    isActive: boolean;
    isDefault: boolean;
  }[];
  images: { id: string; url: string; alt: string | null; isMain: boolean }[];
}): ProductFormValues {
  const nf = Array.isArray(p.nutritionFacts)
    ? (p.nutritionFacts as { label: string; value: string }[])
    : [];
  return {
    id: p.id,
    name: p.name,
    slug: p.slug,
    sku: p.sku ?? "",
    shortDescription: p.shortDescription ?? "",
    description: p.description,
    benefits: p.benefits ?? "",
    ingredients: p.ingredients ?? "",
    categoryId: p.categoryId,
    brandId: p.brandId ?? "",
    isActive: p.isActive,
    isFeatured: p.isFeatured,
    isBestSeller: p.isBestSeller,
    returnable: p.returnable,
    returnWindowDays: p.returnWindowDays,
    gstRate: p.gstRate,
    deliveryRupees: p.deliveryCharge != null ? paiseToRupees(p.deliveryCharge) : null,
    metaTitle: p.metaTitle ?? "",
    metaDescription: p.metaDescription ?? "",
    nutritionFacts: nf,
    variants: p.variants.map((v) => ({
      id: v.id,
      weightLabel: v.weightLabel,
      weightInGrams: v.weightInGrams,
      priceRupees: paiseToRupees(v.price),
      discountRupees: v.discountPrice ? paiseToRupees(v.discountPrice) : null,
      stock: v.stock,
      sku: v.sku ?? "",
      isActive: v.isActive,
      isDefault: v.isDefault,
    })),
    images: p.images.map((im) => ({
      id: im.id,
      url: im.url,
      alt: im.alt ?? "",
      isMain: im.isMain,
    })),
  };
}
