import Image from "next/image";
import type { Prisma } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatDate } from "@/lib/format";

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

type ShippingAddress = {
  fullName: string;
  phone: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  pincode: string;
  country: string;
};

const statusVariant: Record<string, "secondary" | "default" | "destructive"> = {
  PENDING: "secondary",
  PAID: "default",
  PROCESSING: "default",
  SHIPPED: "default",
  DELIVERED: "default",
  CANCELLED: "destructive",
  REFUNDED: "destructive",
};

export function OrderSummaryCard({ order }: { order: OrderWithItems }) {
  const address = order.shippingAddress as unknown as ShippingAddress | null;

  return (
    <div className="space-y-5 rounded-2xl border p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="font-semibold">#{order.orderNumber}</p>
          <p className="text-xs text-muted-foreground">
            Placed {formatDate(order.createdAt)}
          </p>
        </div>
        <Badge variant={statusVariant[order.status] ?? "secondary"}>
          {order.status}
        </Badge>
      </div>

      <ul className="divide-y">
        {order.items.map((item) => (
          <li key={item.id} className="flex gap-3 py-3">
            <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-accent/30">
              {item.image && (
                <Image
                  src={item.image}
                  alt={item.productName}
                  fill
                  sizes="56px"
                  className="object-cover"
                />
              )}
            </div>
            <div className="flex flex-1 items-center justify-between">
              <div className="text-sm">
                <p className="font-medium">{item.productName}</p>
                <p className="text-xs text-muted-foreground">
                  {item.variantLabel} · Qty {item.quantity}
                </p>
              </div>
              <span className="text-sm font-semibold">
                {formatPrice(item.price * item.quantity)}
              </span>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-1.5 border-t pt-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Subtotal</span>
          <span>{formatPrice(order.subtotal)}</span>
        </div>
        {order.discount > 0 && (
          <div className="flex justify-between text-primary">
            <span>Discount {order.couponCode ? `(${order.couponCode})` : ""}</span>
            <span>−{formatPrice(order.discount)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted-foreground">Delivery</span>
          <span className={order.shipping === 0 ? "font-semibold text-primary" : ""}>
            {order.shipping === 0 ? "Free Delivery" : formatPrice(order.shipping)}
          </span>
        </div>
        {order.shipping === 0 && order.shippingSaved > 0 && (
          <p className="text-xs font-medium text-primary">
            You saved {formatPrice(order.shippingSaved)} on shipping
          </p>
        )}
        <div className="flex justify-between border-t pt-2 text-base font-bold">
          <span>Total</span>
          <span>{formatPrice(order.total)}</span>
        </div>
        {order.tax > 0 && (
          <p className="text-xs text-muted-foreground">
            Inclusive of GST {formatPrice(order.tax)}
          </p>
        )}
      </div>

      {address && (
        <div className="border-t pt-3 text-sm">
          <p className="mb-1 text-xs font-semibold uppercase text-muted-foreground">
            Delivery address
          </p>
          <p className="font-medium">{address.fullName}</p>
          <p className="text-muted-foreground">
            {address.line1}
            {address.line2 ? `, ${address.line2}` : ""}
            <br />
            {address.city}, {address.state} {address.pincode}
            <br />
            {address.phone}
          </p>
        </div>
      )}
    </div>
  );
}
