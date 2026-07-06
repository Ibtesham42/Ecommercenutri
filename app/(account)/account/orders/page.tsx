import Link from "next/link";
import type { Metadata } from "next";
import { Package } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatDate } from "@/lib/format";
import { statusBadgeVariant, statusLabel } from "@/lib/order-status";
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
      <div className="rounded-xl border border-dashed p-12 text-center">
        <Package className="mx-auto size-10 text-muted-foreground/40" />
        <p className="mt-3 font-medium">No orders yet</p>
        <p className="mt-1 text-sm text-muted-foreground">
          When you place an order, it will show up here.
        </p>
        <Button asChild className="mt-5">
          <Link href="/products">Start shopping</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {orders.map((order) => (
        <div
          key={order.id}
          className="hover-lift rounded-2xl border bg-card p-4 shadow-elev-1 transition-colors hover:border-primary/30 hover:shadow-elev-2"
        >
          <Link href={`/account/orders/${order.orderNumber}`} className="block">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-semibold">#{order.orderNumber}</p>
                <p className="text-xs text-muted-foreground">
                  {formatDate(order.createdAt)} · {order.items.length} item
                  {order.items.length === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge variant={statusBadgeVariant[order.status] ?? "secondary"}>
                  {statusLabel(order.status)}
                </Badge>
                <span className="font-semibold">{formatPrice(order.total)}</span>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              {order.items.slice(0, 4).map((item) => (
                <span
                  key={item.id}
                  className="relative size-12 shrink-0 overflow-hidden rounded-lg border bg-muted"
                >
                  {item.image && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={item.image}
                      alt={item.productName}
                      className="size-full object-cover"
                    />
                  )}
                </span>
              ))}
              {order.items.length > 4 && (
                <span className="text-xs font-medium text-muted-foreground">
                  +{order.items.length - 4} more
                </span>
              )}
            </div>
          </Link>
          <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
            <Link
              href={`/account/orders/${order.orderNumber}`}
              className="text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              View details
            </Link>
            <BuyAgainButton orderNumber={order.orderNumber} variant="outline" />
          </div>
        </div>
      ))}
    </div>
  );
}
