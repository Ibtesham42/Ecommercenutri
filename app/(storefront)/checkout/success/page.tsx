import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, Package } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { OrderSummaryCard } from "@/components/storefront/order-summary-card";

export const metadata: Metadata = { title: "Order confirmed", robots: { index: false } };

export default async function CheckoutSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order: orderNumber } = await searchParams;
  if (!orderNumber) redirect("/account/orders");

  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const order = await prisma.order.findFirst({
    where: { orderNumber, userId: user.id },
    include: { items: true },
  });
  if (!order) notFound();

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-primary/10 ring-8 ring-primary/5">
          <CheckCircle2 className="size-12 text-primary" />
        </span>
        <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Thank you for your order!</h1>
        <p className="mt-2 text-muted-foreground">
          Your order <span className="font-semibold text-foreground">#{order.orderNumber}</span>{" "}
          has been placed. A confirmation has been sent to your email.
        </p>
      </div>

      <div className="mt-8">
        <OrderSummaryCard order={order} />
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild>
          <Link href={`/account/orders/${order.orderNumber}`}>
            <Package className="size-4" /> View order
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/products">Continue shopping</Link>
        </Button>
      </div>
    </div>
  );
}
