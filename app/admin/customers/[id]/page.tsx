import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Mail, Phone, MapPin } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { Badge } from "@/components/ui/badge";
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

export const metadata: Metadata = { title: "Customer", robots: { index: false } };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await guardSection("customers");
  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: {
      addresses: true,
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          status: true,
          paymentStatus: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      },
    },
  });
  if (!user) notFound();

  const spend = user.orders
    .filter((o) => o.paymentStatus === "PAID")
    .reduce((n, o) => n + o.total, 0);

  return (
    <div>
      <Link
        href="/admin/customers"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to customers
      </Link>

      <PageHeader title={user.name ?? "Customer"} description={`Joined ${formatDate(user.createdAt)}`} />

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border bg-background p-4">
              <p className="text-sm text-muted-foreground">Orders</p>
              <p className="mt-1 text-2xl font-bold">{user.orders.length}</p>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-sm text-muted-foreground">Total spend</p>
              <p className="mt-1 text-2xl font-bold">{formatPrice(spend)}</p>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-sm text-muted-foreground">Addresses</p>
              <p className="mt-1 text-2xl font-bold">{user.addresses.length}</p>
            </div>
          </div>

          <div className="rounded-xl border bg-background">
            <div className="border-b p-4 font-semibold">Orders</div>
            {user.orders.length === 0 ? (
              <p className="p-6 text-sm text-muted-foreground">No orders yet.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {user.orders.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell>
                        <Link
                          href={`/admin/orders/${o.orderNumber}`}
                          className="font-medium hover:text-primary"
                        >
                          #{o.orderNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {formatDate(o.createdAt)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary">{o.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {formatPrice(o.total)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-xl border bg-background p-4 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Contact
            </p>
            <p className="flex items-center gap-2">
              <Mail className="size-4 text-muted-foreground" /> {user.email}
            </p>
            {user.phone && (
              <p className="mt-1 flex items-center gap-2">
                <Phone className="size-4 text-muted-foreground" /> {user.phone}
              </p>
            )}
          </div>

          {user.addresses.length > 0 && (
            <div className="rounded-xl border bg-background p-4 text-sm">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <MapPin className="size-3.5" /> Addresses
              </p>
              <ul className="space-y-3">
                {user.addresses.map((a) => (
                  <li key={a.id} className="text-muted-foreground">
                    <span className="font-medium text-foreground">{a.fullName}</span>
                    <br />
                    {a.line1}
                    {a.line2 ? `, ${a.line2}` : ""}, {a.city}, {a.state} {a.pincode}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
