import Link from "next/link";
import type { Metadata } from "next";
import {
  Package,
  MapPin,
  Heart,
  RotateCcw,
  Megaphone,
  User,
  ArrowRight,
  ShoppingBag,
} from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/storefront/empty-state";
import { MyHealthScoreCard } from "@/components/account/my-health-score";
import { claimQuizForCurrentUser } from "@/lib/actions/quiz";
import { getMyHealthScore } from "@/lib/queries/quiz";
import { formatPrice, formatDate } from "@/lib/format";
import { statusBadgeVariant, statusLabel } from "@/lib/order-status";
import { isPlaceholderEmail } from "@/lib/phone-account";

export const metadata: Metadata = { title: "My Account" };

const QUICK_LINKS = [
  { href: "/account/orders", label: "Orders", icon: Package },
  { href: "/account/returns", label: "Returns", icon: RotateCcw },
  { href: "/account/wishlist", label: "Wishlist", icon: Heart },
  { href: "/account/addresses", label: "Addresses", icon: MapPin },
  { href: "/account/affiliate", label: "Affiliate", icon: Megaphone },
  { href: "/account/profile", label: "Profile", icon: User },
];

export default async function AccountDashboardPage() {
  const sessionUser = await getCurrentUser();

  // Attach any pending anonymous quiz result (taken before signup) + grant the
  // welcome coupon; idempotent. Runs here since /account is the post-login landing page.
  await claimQuizForCurrentUser();

  const [user, healthScore, orders] = await Promise.all([
    prisma.user.findUnique({
      where: { id: sessionUser!.id },
      select: { name: true, email: true },
    }),
    getMyHealthScore(sessionUser!.id),
    prisma.order.findMany({
      where: { userId: sessionUser!.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { items: true },
    }),
  ]);

  const displayName =
    user?.name ?? (isPlaceholderEmail(user?.email ?? "") ? "there" : user?.email ?? "there");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-xl font-semibold sm:text-2xl">
          Hi, {displayName}
        </h1>
        <p className="mt-0.5 text-sm text-muted-foreground">
          Welcome back to your Nutriyet account.
        </p>
      </div>

      {healthScore && <MyHealthScoreCard data={healthScore} />}

      <div>
        <h2 className="mb-3 text-sm font-semibold text-muted-foreground">Quick links</h2>
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {QUICK_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="hover-lift flex flex-col items-center gap-2 rounded-xl border bg-card p-3 text-center shadow-elev-1 transition-colors hover:border-primary/40"
            >
              <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-primary">
                <l.icon className="size-5" />
              </span>
              <span className="text-xs font-medium">{l.label}</span>
            </Link>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-muted-foreground">Recent orders</h2>
          {orders.length > 0 && (
            <Link
              href="/account/orders"
              className="flex items-center gap-1 text-sm font-medium text-primary hover:underline"
            >
              View all <ArrowRight className="size-3.5" />
            </Link>
          )}
        </div>

        {orders.length === 0 ? (
          <EmptyState
            icon={ShoppingBag}
            title="No orders yet"
            description="When you place an order, it will show up here."
            action={{ label: "Start shopping", href: "/products" }}
          />
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/account/orders/${order.orderNumber}`}
                className="hover-lift block rounded-2xl border bg-card p-4 shadow-elev-1 transition-colors hover:border-primary/30 hover:shadow-elev-2"
              >
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
