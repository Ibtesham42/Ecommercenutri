"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Trash2, Eye, EyeOff, Star, Download } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ProductRowActions } from "@/components/admin/product-row-actions";
import { BulkBar, type BulkAction } from "@/components/admin/bulk/bulk-bar";
import { useBulkSelection } from "@/lib/admin/use-bulk-selection";
import { toastBulk } from "@/lib/admin/run-bulk";
import { downloadCsv } from "@/lib/admin/csv-export";
import { bulkProductAction } from "@/lib/actions/admin/products";
import { formatPrice } from "@/lib/format";

export type ProductRow = {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  isFeatured: boolean;
  categoryName: string;
  image: string | null;
  imageAlt: string | null;
  priceMin: number;
  priceMax: number;
  stock: number;
};

const ACTIONS: BulkAction[] = [
  { key: "activate", label: "Activate", icon: Eye },
  { key: "deactivate", label: "Deactivate", icon: EyeOff },
  { key: "feature", label: "Feature", icon: Star },
  { key: "unfeature", label: "Unfeature", icon: Star },
  { key: "export", label: "Export CSV", icon: Download },
  {
    key: "delete",
    label: "Delete",
    icon: Trash2,
    destructive: true,
    confirm: {
      title: "Delete selected products?",
      description:
        "This permanently removes the products and their variants and images. Orders already placed keep their snapshots. This cannot be undone.",
      actionLabel: "Delete",
    },
  },
];

const VERB: Record<string, string> = {
  activate: "activated",
  deactivate: "deactivated",
  feature: "featured",
  unfeature: "unfeatured",
  delete: "deleted",
};

export function ProductTable({ products }: { products: ProductRow[] }) {
  const router = useRouter();
  const ids = products.map((p) => p.id);
  const sel = useBulkSelection(ids);
  const [pending, startTransition] = useTransition();

  function run(key: string) {
    if (key === "export") {
      const rows = products.filter((p) => sel.isSelected(p.id));
      downloadCsv(
        "products",
        ["Name", "Category", "Slug", "Min price", "Max price", "Stock", "Active", "Featured"],
        rows.map((p) => [
          p.name,
          p.categoryName,
          p.slug,
          (p.priceMin / 100).toFixed(2),
          (p.priceMax / 100).toFixed(2),
          String(p.stock),
          p.isActive ? "Yes" : "No",
          p.isFeatured ? "Yes" : "No",
        ]),
      );
      return;
    }
    startTransition(async () => {
      const res = await bulkProductAction(
        sel.selectedIds,
        key as "delete" | "activate" | "deactivate" | "feature" | "unfeature",
      );
      if (toastBulk(res, VERB[key] ?? "updated")) {
        sel.clear();
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-xl border bg-background">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-10">
              <Checkbox
                aria-label="Select all"
                checked={sel.allSelected ? true : sel.someSelected ? "indeterminate" : false}
                onCheckedChange={() => sel.toggleAll()}
              />
            </TableHead>
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
              <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                No products found.
              </TableCell>
            </TableRow>
          ) : (
            products.map((p) => (
              <TableRow key={p.id} data-state={sel.isSelected(p.id) ? "selected" : undefined}>
                <TableCell>
                  <Checkbox
                    aria-label={`Select ${p.name}`}
                    checked={sel.isSelected(p.id)}
                    onCheckedChange={() => sel.toggle(p.id)}
                  />
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <div className="relative size-10 shrink-0 overflow-hidden rounded-md bg-accent/30">
                      {p.image && (
                        <Image
                          src={p.image}
                          alt={p.imageAlt ?? p.name}
                          fill
                          sizes="40px"
                          className="object-cover"
                        />
                      )}
                    </div>
                    <Link href={`/admin/products/${p.id}`} className="font-medium hover:text-primary">
                      {p.name}
                    </Link>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">{p.categoryName}</TableCell>
                <TableCell>
                  {p.priceMin === p.priceMax
                    ? formatPrice(p.priceMin)
                    : `${formatPrice(p.priceMin)}–${formatPrice(p.priceMax)}`}
                </TableCell>
                <TableCell>
                  <span className={p.stock === 0 ? "text-destructive" : ""}>{p.stock}</span>
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
            ))
          )}
        </TableBody>
      </Table>

      <BulkBar
        count={sel.count}
        actions={ACTIONS}
        onRun={run}
        onClear={sel.clear}
        pending={pending}
      />
    </div>
  );
}
