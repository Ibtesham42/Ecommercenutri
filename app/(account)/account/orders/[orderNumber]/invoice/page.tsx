import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStoreSettings } from "@/lib/queries/settings";
import {
  OrderInvoice,
  type InvoiceData,
} from "@/components/storefront/order-invoice";

export const metadata: Metadata = { title: "Invoice", robots: { index: false } };

type ShippingAddress = InvoiceData["billTo"];

export default async function OrderInvoicePage({
  params,
}: {
  params: Promise<{ orderNumber: string }>;
}) {
  const { orderNumber } = await params;
  const user = await getCurrentUser();

  const [order, store] = await Promise.all([
    prisma.order.findFirst({
      where: { orderNumber, userId: user!.id },
      include: { items: true },
    }),
    getStoreSettings(),
  ]);
  if (!order) notFound();

  const data: InvoiceData = {
    orderNumber: order.orderNumber,
    placedAt: order.createdAt.toISOString(),
    paymentStatus: order.paymentStatus,
    store: {
      name: store.siteName,
      address: store.address,
      gstin: store.gstin,
      supportEmail: store.supportEmail,
      supportPhone: store.supportPhone,
    },
    billTo: order.shippingAddress as unknown as ShippingAddress,
    items: order.items.map((i) => ({
      productName: i.productName,
      variantLabel: i.variantLabel,
      quantity: i.quantity,
      price: i.price,
    })),
    subtotal: order.subtotal,
    discount: order.discount,
    couponCode: order.couponCode,
    tax: order.tax,
    shipping: order.shipping,
    shippingSaved: order.shippingSaved,
    total: order.total,
  };

  return (
    <div className="space-y-5">
      <Link
        href={`/account/orders/${order.orderNumber}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground print:hidden"
      >
        <ArrowLeft className="size-4" /> Back to order
      </Link>
      <OrderInvoice data={data} />
    </div>
  );
}
