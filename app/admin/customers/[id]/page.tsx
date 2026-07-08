import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, Mail, Phone, MapPin, Star, Heart, Sparkles, Ticket, Megaphone } from "lucide-react";
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
      affiliate: { select: { status: true, code: true } },
      healthQuizzes: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { score: true, createdAt: true },
      },
      _count: { select: { reviews: true, wishlist: true, healthQuizzes: true } },
      orders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          total: true,
          status: true,
          paymentStatus: true,
          couponCode: true,
          createdAt: true,
          _count: { select: { items: true } },
        },
      },
    },
  });
  if (!user) notFound();

  const paidOrders = user.orders.filter((o) => o.paymentStatus === "PAID");
  const spend = paidOrders.reduce((n, o) => n + o.total, 0);
  const aov = paidOrders.length ? Math.round(spend / paidOrders.length) : 0;
  const lastOrder = user.orders[0] ?? null;
  const couponsUsed = new Set(
    user.orders.map((o) => o.couponCode).filter((c): c is string => Boolean(c)),
  );
  const latestQuiz = user.healthQuizzes[0] ?? null;

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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border bg-background p-4">
              <p className="text-sm text-muted-foreground">Orders</p>
              <p className="mt-1 text-2xl font-bold">{user.orders.length}</p>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-sm text-muted-foreground">Total spend</p>
              <p className="mt-1 text-2xl font-bold">{formatPrice(spend)}</p>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-sm text-muted-foreground">Avg. order value</p>
              <p className="mt-1 text-2xl font-bold">{aov ? formatPrice(aov) : "—"}</p>
            </div>
            <div className="rounded-xl border bg-background p-4">
              <p className="text-sm text-muted-foreground">Last order</p>
              <p className="mt-1 text-2xl font-bold">
                {lastOrder ? formatDate(lastOrder.createdAt) : "—"}
              </p>
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

          <div className="rounded-xl border bg-background p-4 text-sm">
            <p className="mb-3 text-xs font-semibold uppercase text-muted-foreground">
              Activity
            </p>
            <ul className="space-y-2">
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Star className="size-4" /> Reviews
                </span>
                <span className="font-medium">{user._count.reviews}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Heart className="size-4" /> Wishlist
                </span>
                <span className="font-medium">{user._count.wishlist}</span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Sparkles className="size-4" /> Assessment
                </span>
                <span className="font-medium">
                  {latestQuiz ? `${latestQuiz.score}/100` : `${user._count.healthQuizzes} taken`}
                </span>
              </li>
              <li className="flex items-center justify-between">
                <span className="flex items-center gap-2 text-muted-foreground">
                  <Ticket className="size-4" /> Coupons used
                </span>
                <span className="font-medium">{couponsUsed.size}</span>
              </li>
            </ul>
          </div>

          {user.affiliate && (
            <div className="rounded-xl border bg-background p-4 text-sm">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                <Megaphone className="size-3.5" /> Affiliate
              </p>
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={user.affiliate.status === "APPROVED" ? "default" : "secondary"}>
                  {user.affiliate.status}
                </Badge>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Code</span>
                <span className="font-medium">{user.affiliate.code}</span>
              </div>
            </div>
          )}

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
