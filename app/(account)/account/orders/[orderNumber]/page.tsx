import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, FileText, Download } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { OrderSummaryCard } from "@/components/storefront/order-summary-card";
import { OrderTimeline } from "@/components/storefront/order-timeline";
import { CancelOrderButton } from "@/components/storefront/cancel-order-button";
import { ReturnRequestButton } from "@/components/account/return-request-button";
import { isCustomerCancellable } from "@/lib/order-status";
import { returnStatusLabel } from "@/lib/return-status";
import { getReturnEligibility } from "@/lib/returns";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Order details" };

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const user = await getCurrentUser();

  const order = await prisma.order.findFirst({
    where: { orderNumber, userId: user!.id },
    include: {
      items: true,
      events: { orderBy: { createdAt: "asc" } },
      returns: { orderBy: { createdAt: "desc" }, select: { returnNumber: true, status: true } },
    },
  });
  if (!order) notFound();

  const cancellable = isCustomerCancellable(order.status);
  const eligibility = await getReturnEligibility(order.id);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to orders
        </Link>
        <div className="flex flex-wrap gap-2">
          {cancellable && <CancelOrderButton orderNumber={order.orderNumber} />}
          {eligibility.eligible && (
            <ReturnRequestButton
              orderNumber={order.orderNumber}
              items={eligibility.items}
              cloudinaryReady={isConfigured.cloudinary()}
            />
          )}
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link href={`/account/orders/${order.orderNumber}/invoice`}>
              <FileText className="size-4" /> View invoice
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-2">
            <a href={`/api/invoices/${order.orderNumber}?download=1`}>
              <Download className="size-4" /> Download PDF
            </a>
          </Button>
        </div>
      </div>

      {order.returns.length > 0 && (
        <div className="rounded-xl border bg-accent/30 p-4 text-sm">
          <p className="font-medium">Returns for this order</p>
          <ul className="mt-2 space-y-1">
            {order.returns.map((r) => (
              <li key={r.returnNumber}>
                <Link
                  href={`/account/returns/${r.returnNumber}`}
                  className="text-primary hover:underline"
                >
                  {r.returnNumber}
                </Link>
                <span className="ml-2 text-muted-foreground">· {returnStatusLabel(r.status)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_300px]">
        <OrderSummaryCard order={order} />
        <aside className="h-fit rounded-2xl border p-5">
          <h2 className="mb-4 font-semibold">Order status</h2>
          <OrderTimeline
            status={order.status}
            placedAt={order.createdAt.toISOString()}
            cancelReason={order.cancelReason}
            events={order.events.map((e) => ({
              status: e.status,
              note: e.note,
              createdAt: e.createdAt.toISOString(),
            }))}
          />
        </aside>
      </div>
    </div>
  );
}
