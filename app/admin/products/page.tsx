import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { ProductTable, type ProductRow } from "@/components/admin/product-table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";
import { effectivePrice } from "@/lib/format";

export const metadata: Metadata = { title: "Products", robots: { index: false } };

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  await guardSection("products");
  const { q = "" } = await searchParams;

  const where: Prisma.ProductWhereInput = q
    ? {
        OR: [
          { name: { contains: q, mode: "insensitive" } },
          { sku: { contains: q, mode: "insensitive" } },
          { category: { name: { contains: q, mode: "insensitive" } } },
        ],
      }
    : {};

  const products = await prisma.product.findMany({
    where,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      slug: true,
      isActive: true,
      isFeatured: true,
      category: { select: { name: true } },
      images: {
        orderBy: [{ isMain: "desc" }, { sortOrder: "asc" }],
        take: 1,
        select: { url: true, alt: true },
      },
      variants: { select: { price: true, discountPrice: true, stock: true } },
    },
  });

  const rows: ProductRow[] = products.map((p) => {
    const prices = p.variants.map((v) => effectivePrice(v.price, v.discountPrice));
    return {
      id: p.id,
      name: p.name,
      slug: p.slug,
      isActive: p.isActive,
      isFeatured: p.isFeatured,
      categoryName: p.category.name,
      image: p.images[0]?.url ?? null,
      imageAlt: p.images[0]?.alt ?? null,
      priceMin: prices.length ? Math.min(...prices) : 0,
      priceMax: prices.length ? Math.max(...prices) : 0,
      stock: p.variants.reduce((n, v) => n + v.stock, 0),
    };
  });

  return (
    <div>
      <PageHeader title="Products" description={`${products.length} product${products.length === 1 ? "" : "s"}`}>
        <Button asChild className="gap-1.5">
          <Link href="/admin/products/new">
            <Plus className="size-4" /> New product
          </Link>
        </Button>
      </PageHeader>

      <form action="/admin/products" className="mb-4 max-w-sm">
        <Input name="q" placeholder="Search products…" defaultValue={q} />
      </form>

      <ProductTable products={rows} />
    </div>
  );
}
