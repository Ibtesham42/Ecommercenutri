import type { Metadata } from "next";
import { Package } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/storefront/empty-state";
import { OrderRow } from "@/components/account/order-row";
import { BuyAgainButton } from "@/components/account/buy-again-button";

export const metadata: Metadata = { title: "Orders" };

export default async function OrdersPage() {
  const user = await getCurrentUser();
  const orders = await prisma.order.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: "desc" },
    include: { items: true },
  });

  if (orders.length === 0) {
    return (
      <EmptyState
        icon={Package}
        title="No orders yet"
        description="When you place an order, it will show up here."
        action={{ label: "Start shopping", href: "/products" }}
      />
    );
  }

  return (
    <ul className="divide-y divide-border border-y border-border">
      {orders.map((order) => (
        <OrderRow
          key={order.id}
          order={order}
          actions={<BuyAgainButton orderNumber={order.orderNumber} variant="outline" />}
        />
      ))}
    </ul>
  );
}
