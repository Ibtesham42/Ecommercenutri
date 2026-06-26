import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { ProductForm } from "@/components/admin/product-form";
import { productToFormValues } from "@/lib/admin/product-form-values";
import { prisma } from "@/lib/prisma";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Edit product", robots: { index: false } };

export default async function EditProductPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await guardSection("products");
  const { id } = await params;

  const [product, categories, brands] = await Promise.all([
    prisma.product.findUnique({
      where: { id },
      include: {
        variants: { orderBy: { weightInGrams: "asc" } },
        images: { orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }] },
      },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  if (!product) notFound();

  return (
    <div>
      <PageHeader title="Edit product" description={product.name} />
      <ProductForm
        categories={categories}
        brands={brands}
        initial={productToFormValues(product)}
        cloudinaryReady={isConfigured.cloudinary()}
      />
    </div>
  );
}
