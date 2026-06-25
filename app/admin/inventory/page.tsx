import type { Metadata } from "next";
import type { Prisma } from "@prisma/client";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { InventoryStockInput } from "@/components/admin/inventory-stock-input";
import { Badge } from "@/components/ui/badge";
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

export const metadata: Metadata = { title: "Inventory", robots: { index: false } };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; low?: string }>;
}) {
  await guardSection("inventory");
  const { q = "", low = "" } = await searchParams;

  const where: Prisma.ProductVariantWhereInput = {
    ...(low ? { stock: { lte: 10 } } : {}),
    ...(q
      ? {
          OR: [
            { weightLabel: { contains: q, mode: "insensitive" } },
            { sku: { contains: q, mode: "insensitive" } },
            { product: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const variants = await prisma.productVariant.findMany({
    where,
    orderBy: [{ stock: "asc" }, { product: { name: "asc" } }],
    select: {
      id: true,
      weightLabel: true,
      sku: true,
      stock: true,
      isActive: true,
      product: { select: { name: true } },
    },
  });

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Adjust stock levels per variant. Press Enter or the check to save."
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Link
          href="/admin/inventory"
          className={`rounded-full border px-3 py-1 text-sm transition hover:bg-accent ${!low ? "border-primary bg-primary/10 text-primary" : ""}`}
        >
          All
        </Link>
        <Link
          href="/admin/inventory?low=1"
          className={`rounded-full border px-3 py-1 text-sm transition hover:bg-accent ${low ? "border-primary bg-primary/10 text-primary" : ""}`}
        >
          Low stock (≤ 10)
        </Link>
        <form action="/admin/inventory" className="ml-auto max-w-xs flex-1">
          {low && <input type="hidden" name="low" value={low} />}
          <Input name="q" placeholder="Search variant or product…" defaultValue={q} />
        </form>
      </div>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Product</TableHead>
              <TableHead>Variant</TableHead>
              <TableHead>SKU</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Stock</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variants.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="py-10 text-center text-muted-foreground">
                  No variants found.
                </TableCell>
              </TableRow>
            ) : (
              variants.map((v) => (
                <TableRow key={v.id}>
                  <TableCell className="font-medium">{v.product.name}</TableCell>
                  <TableCell>{v.weightLabel}</TableCell>
                  <TableCell className="text-muted-foreground">{v.sku ?? "—"}</TableCell>
                  <TableCell>
                    {v.stock === 0 ? (
                      <Badge variant="destructive">Out</Badge>
                    ) : v.stock <= 10 ? (
                      <Badge variant="secondary" className="text-amber-600">Low</Badge>
                    ) : (
                      <Badge variant="secondary">OK</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <InventoryStockInput variantId={v.id} stock={v.stock} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
