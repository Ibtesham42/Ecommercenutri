import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { formatPrice, effectivePrice } from "@/lib/format";

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

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Stock</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-10" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No products found.
                </TableCell>
              </TableRow>
            ) : (
              products.map((p) => {
                const prices = p.variants.map((v) => effectivePrice(v.price, v.discountPrice));
                const min = prices.length ? Math.min(...prices) : 0;
                const max = prices.length ? Math.max(...prices) : 0;
                const stock = p.variants.reduce((n, v) => n + v.stock, 0);
                return (
                  <TableRow key={p.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-accent/30">
                          {p.images[0] && (
                            <Image
                              src={p.images[0].url}
                              alt={p.images[0].alt ?? p.name}
                              fill
                              sizes="40px"
                              className="object-cover"
                            />
                          )}
                        </div>
                        <Link
                          href={`/admin/products/${p.id}`}
                          className="font-medium hover:text-primary"
                        >
                          {p.name}
                        </Link>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">{p.category.name}</TableCell>
                    <TableCell>
                      {min === max ? formatPrice(min) : `${formatPrice(min)}–${formatPrice(max)}`}
                    </TableCell>
                    <TableCell>
                      <span className={stock === 0 ? "text-destructive" : ""}>{stock}</span>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1.5">
                        <Badge variant={p.isActive ? "default" : "secondary"}>
                          {p.isActive ? "Active" : "Draft"}
                        </Badge>
                        {p.isFeatured && (
                          <Badge variant="secondary" className="bg-primary/10 text-primary">
                            Featured
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <ProductRowActions
                        id={p.id}
                        slug={p.slug}
                        isActive={p.isActive}
                        isFeatured={p.isFeatured}
                      />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
