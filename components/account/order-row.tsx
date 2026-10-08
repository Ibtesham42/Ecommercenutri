import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { ChevronRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatPrice, formatDate } from "@/lib/format";
import { statusBadgeVariant, statusLabel } from "@/lib/order-status";

type OrderWithItems = Prisma.OrderGetPayload<{ include: { items: true } }>;

/**
 * One order in an account list (dashboard, orders page): number, date, status
 * and total over a strip of item thumbnails. The whole summary links to the
 * order; `actions` (e.g. Buy again) sit outside the link so no control nests
 * inside another.
 */
export function OrderRow({ order, actions }: { order: OrderWithItems; actions?: React.ReactNode }) {
  const href = `/account/orders/${order.orderNumber}`;
  return (
    <li className="py-5">
      <Link href={href} className="group block outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div>
            <p className="flex items-center gap-1 font-medium">
              #{order.orderNumber}
              <ChevronRight
                className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
                aria-hidden
              />
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {formatDate(order.createdAt)} · {order.items.length} item{order.items.length === 1 ? "" : "s"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Badge variant={statusBadgeVariant[order.status] ?? "secondary"}>{statusLabel(order.status)}</Badge>
            <span className="font-semibold tabular-nums">{formatPrice(order.total)}</span>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2">
          {order.items.slice(0, 4).map((item) => (
            <span key={item.id} className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-oat">
              {item.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.image} alt={item.productName} className="size-full object-cover" />
              )}
            </span>
          ))}
          {order.items.length > 4 && (
            <span className="text-sm text-muted-foreground">+{order.items.length - 4} more</span>
          )}
        </div>
      </Link>
      {actions && <div className="mt-3 flex flex-wrap items-center gap-2">{actions}</div>}
    </li>
  );
}
