import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { ProductForm } from "@/components/admin/product-form";
import { prisma } from "@/lib/prisma";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "New product", robots: { index: false } };

export default async function NewProductPage() {
  const [categories, brands] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.brand.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  return (
    <div>
      <PageHeader title="New product" description="Add a product to the catalog." />
      <ProductForm
        categories={categories}
        brands={brands}
        cloudinaryReady={isConfigured.cloudinary()}
      />
    </div>
  );
}
