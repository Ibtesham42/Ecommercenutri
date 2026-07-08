import Link from "next/link";
import type { Metadata } from "next";
import type { Prisma, OrderStatus, PaymentStatus } from "@prisma/client";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { OrderTable, type OrderRow } from "@/components/admin/order-table";
import { prisma } from "@/lib/prisma";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Orders", robots: { index: false } };

const FILTERS: { label: string; value: string }[] = [
  { label: "All", value: "" },
  { label: "Pending", value: "PENDING" },
  { label: "Approved", value: "APPROVED" },
  { label: "Processing", value: "PROCESSING" },
  { label: "Packed", value: "PACKED" },
  { label: "Shipped", value: "SHIPPED" },
  { label: "Out for delivery", value: "OUT_FOR_DELIVERY" },
  { label: "Delivered", value: "DELIVERED" },
  { label: "Cancelled", value: "CANCELLED" },
  { label: "Returned", value: "RETURNED" },
  { label: "Refunded", value: "REFUNDED" },
];

const PAYMENT_FILTERS: { label: string; value: string }[] = [
  { label: "Any payment", value: "" },
  { label: "Paid", value: "PAID" },
  { label: "Pending", value: "PENDING" },
  { label: "Refunded", value: "REFUNDED" },
];

const PER_PAGE = 20;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string; payment?: string; page?: string }>;
}) {
  await guardSection("orders");
  const { status = "", q = "", payment = "", page = "1" } = await searchParams;
  const currentPage = Math.max(1, Number(page) || 1);

  const where: Prisma.OrderWhereInput = {
    ...(status ? { status: status as OrderStatus } : {}),
    ...(payment ? { paymentStatus: payment as PaymentStatus } : {}),
    ...(q
      ? {
          OR: [
            { orderNumber: { contains: q, mode: "insensitive" } },
            { user: { email: { contains: q, mode: "insensitive" } } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { phone: { contains: q, mode: "insensitive" } } },
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

  const rows: OrderRow[] = orders.map((o) => ({
    id: o.id,
    orderNumber: o.orderNumber,
    customer: o.user.name ?? o.user.email ?? "—",
    createdAt: o.createdAt.toISOString(),
    paymentStatus: o.paymentStatus,
    status: o.status,
    total: o.total,
    items: o._count.items,
  }));

  const pageCount = Math.max(1, Math.ceil(total / PER_PAGE));
  const qs = (next: Record<string, string>) => {
    const p = new URLSearchParams({ status, q, payment, ...next });
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
          {payment && <input type="hidden" name="payment" value={payment} />}
          <Input
            name="q"
            placeholder="Search order #, name, email or phone"
            defaultValue={q}
            className="w-64"
          />
          <Button type="submit" variant="outline">
            Search
          </Button>
        </form>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">Payment</span>
        {PAYMENT_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={qs({ payment: f.value, page: "1" })}
            className={cn(
              "rounded-full border px-3 py-1 text-xs transition hover:bg-accent",
              payment === f.value && "border-primary bg-primary/10 text-primary",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <OrderTable orders={rows} />

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
