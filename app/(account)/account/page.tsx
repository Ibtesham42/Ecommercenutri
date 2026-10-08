import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight, ShoppingBag } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EmptyState } from "@/components/storefront/empty-state";
import { MyHealthScoreCard } from "@/components/account/my-health-score";
import { claimQuizForCurrentUser } from "@/lib/actions/quiz";
import { getMyHealthScore } from "@/lib/queries/quiz";
import { OrderRow } from "@/components/account/order-row";

export const metadata: Metadata = { title: "My Account" };


export default async function AccountDashboardPage() {
  const sessionUser = await getCurrentUser();

  // Attach any pending anonymous quiz result (taken before signup) + grant the
  // welcome coupon; idempotent. Runs here since /account is the post-login landing page.
  await claimQuizForCurrentUser();

  const [healthScore, orders] = await Promise.all([
    getMyHealthScore(sessionUser!.id),
    prisma.order.findMany({
      where: { userId: sessionUser!.id },
      orderBy: { createdAt: "desc" },
      take: 3,
      include: { items: true },
    }),
  ]);

  return (
    <div className="space-y-12">
      {healthScore && <MyHealthScoreCard data={healthScore} />}

      <section aria-labelledby="recent-orders">
        <div className="mb-2 flex items-end justify-between gap-4">
          <h2 id="recent-orders" className="font-heading text-subheading font-medium">
            Recent orders
          </h2>
          {orders.length > 0 && (
            <Link
              href="/account/orders"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-primary underline-offset-4 hover:underline"
            >
              View all <ArrowRight className="size-4" />
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
          <ul className="divide-y divide-border border-y border-border">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
