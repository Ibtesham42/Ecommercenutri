import Link from "next/link";
import type { Metadata } from "next";
import { RotateCcw } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/storefront/empty-state";
import { formatPrice, formatDate } from "@/lib/format";
import { returnStatusLabel, returnBadgeVariant } from "@/lib/return-status";

export const metadata: Metadata = { title: "Returns & Refunds" };

export default async function ReturnsListPage() {
  const user = await getCurrentUser();
  const returns = await prisma.returnRequest.findMany({
    where: { userId: user!.id },
    orderBy: { createdAt: "desc" },
    include: {
      order: { select: { orderNumber: true } },
      _count: { select: { items: true } },
    },
  });

  return (
    <div className="space-y-4">
      <h1 className="font-heading text-xl font-semibold sm:text-2xl">Returns &amp; Refunds</h1>

      {returns.length === 0 ? (
        <EmptyState
          icon={RotateCcw}
          title="No returns yet"
          description="When you request a return or refund on a delivered order, it'll show up here."
          action={{ label: "View orders", href: "/account/orders" }}
        />
      ) : (
        <ul className="space-y-3">
          {returns.map((r) => (
            <li key={r.id}>
              <Link
                href={`/account/returns/${r.returnNumber}`}
                className="block rounded-2xl border bg-card p-4 shadow-elev-1 transition-colors hover:border-primary/30 hover:shadow-elev-2"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-medium">{r.returnNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      Order #{r.order.orderNumber} · {r._count.items} item
                      {r._count.items === 1 ? "" : "s"} · {formatDate(r.createdAt)}
                    </p>
                  </div>
                  <div className="text-right">
                    <Badge variant={returnBadgeVariant[r.status]}>
                      {returnStatusLabel(r.status)}
                    </Badge>
                    <p className="mt-1 text-sm font-semibold">
                      {formatPrice(r.refundedAmount || r.refundAmount)}
                    </p>
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
