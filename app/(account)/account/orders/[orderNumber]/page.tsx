import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft, FileText, Download } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { OrderSummaryCard } from "@/components/storefront/order-summary-card";

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
    include: { items: true },
  });
  if (!order) notFound();

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/account/orders"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to orders
        </Link>
        <div className="flex gap-2">
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
      <OrderSummaryCard order={order} />
    </div>
  );
}
