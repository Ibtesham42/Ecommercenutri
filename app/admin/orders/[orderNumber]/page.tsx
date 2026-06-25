import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { OrderStatusSelect } from "@/components/admin/order-status-select";
import { OrderSummaryCard } from "@/components/storefront/order-summary-card";
import { Badge } from "@/components/ui/badge";
import { prisma } from "@/lib/prisma";
import { formatDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Order detail", robots: { index: false } };

export default async function AdminOrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const order = await prisma.order.findUnique({
    where: { orderNumber },
    include: { items: true, user: { select: { name: true, email: true, phone: true } } },
  });
  if (!order) notFound();

  return (
    <div>
      <Link
        href="/admin/orders"
        className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Back to orders
      </Link>

      <PageHeader title={`Order #${order.orderNumber}`} description={formatDateTime(order.createdAt)}>
        <OrderStatusSelect orderId={order.id} status={order.status} />
      </PageHeader>

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <OrderSummaryCard order={order} />

        <aside className="space-y-4">
          <div className="rounded-xl border bg-background p-4 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Customer
            </p>
            <p className="font-medium">{order.user.name ?? "—"}</p>
            <p className="text-muted-foreground">{order.user.email}</p>
            {order.user.phone && (
              <p className="text-muted-foreground">{order.user.phone}</p>
            )}
          </div>

          <div className="rounded-xl border bg-background p-4 text-sm">
            <p className="mb-2 text-xs font-semibold uppercase text-muted-foreground">
              Payment
            </p>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Status</span>
              <Badge variant={order.paymentStatus === "PAID" ? "default" : "secondary"}>
                {order.paymentStatus}
              </Badge>
            </div>
            {order.razorpayPaymentId && (
              <div className="mt-2 break-all text-xs text-muted-foreground">
                Razorpay: {order.razorpayPaymentId}
              </div>
            )}
            {order.couponCode && (
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Coupon</span>
                <span className="font-medium">{order.couponCode}</span>
              </div>
            )}
          </div>

          {order.notes && (
            <div className="rounded-xl border bg-background p-4 text-sm">
              <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
                Notes
              </p>
              <p className="text-muted-foreground">{order.notes}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
