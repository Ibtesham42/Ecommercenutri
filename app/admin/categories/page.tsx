import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { CategoryManager, type CategoryRow } from "@/components/admin/category-manager";
import { prisma } from "@/lib/prisma";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Categories", robots: { index: false } };

export default async function AdminCategoriesPage() {
  const categories = await prisma.category.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      parent: { select: { name: true } },
      _count: { select: { products: true } },
    },
  });

  const rows: CategoryRow[] = categories.map((c) => ({
    id: c.id,
    name: c.name,
    slug: c.slug,
    description: c.description,
    image: c.image,
    parentId: c.parentId,
    sortOrder: c.sortOrder,
    isActive: c.isActive,
    productCount: c._count.products,
    parentName: c.parent?.name ?? null,
  }));

  return (
    <div>
      <PageHeader title="Categories" description="Organize your catalog." />
      <CategoryManager categories={rows} cloudinaryReady={isConfigured.cloudinary()} />
    </div>
  );
}
