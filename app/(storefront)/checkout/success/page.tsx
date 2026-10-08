import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { Check, Package, Truck, Sparkles, ArrowRight } from "lucide-react";
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

  const firstName = user.name?.trim().split(/\s+/)[0];

  return (
    <div className="shop-container pt-10 pb-24 sm:pt-14">
      <div className="mx-auto max-w-2xl">
        <header className="motion-safe:animate-fade-up text-center">
          <span className="mx-auto grid size-14 place-items-center rounded-full bg-primary text-primary-foreground">
            <Check className="size-7" strokeWidth={2.25} aria-hidden />
          </span>
          <p className="eyebrow mt-6">Order confirmed</p>
          <h1 className="mt-2 font-heading text-title text-foreground sm:mt-3">
            Thank you{firstName ? `, ${firstName}` : ""}.
          </h1>
          <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Your order <span className="font-medium text-foreground">#{order.orderNumber}</span>{" "}
            has been placed. A confirmation has been sent to your email.
          </p>
        </header>

        {/* Delivery reassurance — cuts post-purchase anxiety + "where is my order" support load. */}
        <p className="mt-8 flex items-start gap-3 rounded-xl bg-oat px-4 py-3.5 text-sm text-oat-foreground sm:items-center">
          <Truck className="mt-0.5 size-4 shrink-0 sm:mt-0" strokeWidth={1.75} aria-hidden />
          <span>Usually delivered in 3–5 business days · track it anytime from your orders.</span>
        </p>

        <div className="mt-6">
          <OrderSummaryCard order={order} className="rounded-xl border-border shadow-none" />
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild className="h-12 flex-1 gap-2 rounded-lg text-[15px]">
            <Link href={`/account/orders/${order.orderNumber}`}>
              <Package className="size-4" /> View order
            </Link>
          </Button>
          <Button
            asChild
            variant="outline"
            className="h-12 flex-1 rounded-lg border-foreground/70 bg-transparent text-[15px] hover:bg-foreground hover:text-background"
          >
            <Link href="/products">Continue shopping</Link>
          </Button>
        </div>

        {/* AI Assessment invite — a high-engagement moment to start personalization
            (only when the shopper hasn't taken it and the quiz is enabled). */}
        {showQuizInvite && (
          <Link
            href="/quiz"
            className="group mt-10 flex items-center gap-4 rounded-xl border border-border bg-card p-5 transition-colors hover:border-foreground/30"
          >
            <span className="grid size-11 shrink-0 place-items-center rounded-full bg-oat">
              <Sparkles className="size-5 text-terracotta" strokeWidth={1.75} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-heading text-subheading">
                While your order ships — meet your nutrition coach
              </span>
              <span className="mt-1 block text-sm text-muted-foreground">
                Take the free 60-second Health Assessment for snacks matched to your goals.
              </span>
            </span>
            <ArrowRight
              className="size-5 shrink-0 text-foreground/60 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden
            />
          </Link>
        )}
      </div>

      {/* Post-purchase discovery — seeds the next order (repeat purchase / AOV). */}
      {recommended.length > 0 && (
        <RecoSection
          className="mt-20 lg:mt-24"
          title="Popular with our customers"
          subtitle="Loved by the Nutriyet community — add these to your next box."
          products={recommended}
          source="order-success"
        />
      )}
    </div>
  );
}
