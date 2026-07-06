import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { CheckCircle2, Package, Truck, Sparkles, ArrowRight } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { OrderSummaryCard } from "@/components/storefront/order-summary-card";
import { RecoSection } from "@/components/storefront/reco-section";
import { getBestSellers } from "@/lib/queries/products";
import { getMyHealthScore } from "@/lib/queries/quiz";
import { getGrowthSettings } from "@/lib/growth-settings";

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

  // Post-purchase engagement (all additive, best-effort): recommend more, invite
  // the AI assessment if they haven't taken it, surface the welcome coupon copy.
  // The highest-intent moment in the funnel — turn a dead end into retention.
  const purchasedIds = new Set(
    order.items.map((i) => i.productId).filter((id): id is string => Boolean(id)),
  );
  const [bestSellers, healthScore, growth] = await Promise.all([
    getBestSellers(10),
    getMyHealthScore(user.id),
    getGrowthSettings(),
  ]);
  const recommended = bestSellers.filter((p) => !purchasedIds.has(p.id)).slice(0, 5);
  const showQuizInvite = growth.quizEnabled && !healthScore;

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-12">
      <div className="motion-safe:animate-fade-up text-center">
        <span className="mx-auto grid size-20 place-items-center rounded-full bg-primary/10 ring-8 ring-primary/5">
          <CheckCircle2 className="size-12 text-primary" />
        </span>
        <h1 className="mt-5 text-2xl font-bold sm:text-3xl">Thank you for your order!</h1>
        <p className="mt-2 text-muted-foreground">
          Your order <span className="font-semibold text-foreground">#{order.orderNumber}</span>{" "}
          has been placed. A confirmation has been sent to your email.
        </p>
      </div>

      {/* Delivery reassurance — cuts post-purchase anxiety + "where is my order" support load. */}
      <div className="mt-6 flex items-center justify-center gap-2 rounded-2xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm font-medium text-primary">
        <Truck className="size-4 shrink-0" />
        <span>Usually delivered in 3–5 business days · track anytime from your orders</span>
      </div>

      <div className="mt-8">
        <OrderSummaryCard order={order} />
      </div>

      <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Button asChild className="btn-rich">
          <Link href={`/account/orders/${order.orderNumber}`}>
            <Package className="size-4" /> View order
          </Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/products">Continue shopping</Link>
        </Button>
      </div>

      {/* AI Assessment invite — a high-engagement moment to start personalization
          (only when the shopper hasn't taken it and the quiz is enabled). */}
      {showQuizInvite && (
        <Link
          href="/quiz"
          className="surface-rich hover-lift group mt-10 flex items-center gap-4 overflow-hidden rounded-3xl p-5 text-surface-deep-foreground shadow-elev-2"
        >
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-white/10 ring-1 ring-white/15">
            <Sparkles className="size-6 text-gold" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-heading text-lg font-semibold">
              While your order ships — meet your nutrition coach
            </span>
            <span className="mt-0.5 block text-sm text-surface-deep-foreground/80">
              Take the free 60-second Health Assessment for snacks matched to your goals.
            </span>
          </span>
          <ArrowRight className="size-5 shrink-0 text-gold transition-transform group-hover:translate-x-0.5" />
        </Link>
      )}

      {/* Post-purchase discovery — seeds the next order (repeat purchase / AOV). */}
      {recommended.length > 0 && (
        <RecoSection
          className="mt-14"
          title="Popular with our customers"
          subtitle="Loved by the Nutriyet community — add these to your next box."
          products={recommended}
          source="order-success"
        />
      )}
    </div>
  );
}
