import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getInvoiceData } from "@/lib/invoices";
import { OrderInvoice } from "@/components/storefront/order-invoice";

export const metadata: Metadata = { title: "Invoice", robots: { index: false } };

export default async function OrderInvoicePage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const user = await getCurrentUser();

  const order = await prisma.order.findFirst({
    where: { orderNumber, userId: user!.id },
    select: { id: true },
  });
  if (!order) notFound();

  const data = await getInvoiceData(order.id);
  if (!data) notFound();

  return (
    <div className="space-y-5">
      <Link
        href={`/account/orders/${data.orderNumber}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeft className="size-4" /> Back to order
      </Link>
      <OrderInvoice data={data} />
    </div>
  );
}
