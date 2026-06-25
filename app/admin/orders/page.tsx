import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma, OrderStatus } from "@prisma/client";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { prisma } from "@/lib/prisma";
import { formatPrice, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders", robots: { index: false } };

const FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Shipped", value: "SHIPPED" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Cancelled", value: "CANCELLED" },
];

const PER_PAGE = 20;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; page?: string }>;
}) {
  const { status = "", q = "", page = "1" } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);

  const where: Prisma.OrderWhereInput = {
    ...(status ? { status: status as OrderStatus } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { name: { contains: q, mode: "insensitive" } } },
          ],
        }
      : {}),
  };

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * PER_PAGE,
      take: PER_PAGE,
      select: {
        id: true,
        orderNumber: true,
        total: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (next: Record<string, string>) => {
    const p = new URLSearchParams({ status, q, ...next });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `?${p.toString()}`;
  };

  return (
    <div>
      <PageHeader title="Orders" description={`${total} order${total === 1 ? "" : "s"}`} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={qs({ status: f.value, page: "1" })}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition hover:bg-accent",
              status === f.value && "border-primary bg-primary/10 text-primary",
            )}
          >
            {f.label}
          </Link>
        ))}
        <form action="/admin/orders" className="ml-auto flex gap-2">
          {status && <input type="hidden" name="status" value={status} />}
          <Input
            name="q"
            placeholder="Search order # or customer"
            defaultValue={q}
            className="w-56"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      <div className="rounded-xl border bg-background">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Order</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Payment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((o) => (
                <TableRow key={o.id} className="cursor-pointer">
                  <TableCell>
                    <Link
                      href={`/admin/orders/${o.orderNumber}`}
                      className="font-medium hover:text-primary"
                    >
                      #{o.orderNumber}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {o._count.items} item{o._count.items === 1 ? "" : "s"}
                    </p>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate">
                    {o.user.name ?? o.user.email}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {formatDate(o.createdAt)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={o.paymentStatus === "PAID" ? "default" : "secondary"}
                    >
                      {o.paymentStatus}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">{o.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {formatPrice(o.total)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {pageCount > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Page {currentPage} of {pageCount}
          </span>
          <div className="flex gap-2">
            {currentPage > 1 ? (
              <Button asChild variant="outline" size="sm">
                <Link href={qs({ page: String(currentPage - 1) })}>Previous</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Previous
              </Button>
            )}
            {currentPage < pageCount ? (
              <Button asChild variant="outline" size="sm">
                <Link href={qs({ page: String(currentPage + 1) })}>Next</Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>
                Next
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
