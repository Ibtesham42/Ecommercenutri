import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { TrackOrderForm } from "@/components/storefront/track-order-form";
import { PageBreadcrumb } from "@/components/storefront/page-breadcrumb";

export const metadata: Metadata = buildMetadata({
  title: "Track your order",
  description: "Check the status of your Nutriyet order with your order number and email.",
  path: "/track",
});

export default function TrackOrderPage() {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <PageBreadcrumb items={[{ name: "Home", href: "/" }, { name: "Track Order" }]} />

      <header className="mt-6 max-w-xl">
        <h1 className="text-3xl font-bold sm:text-4xl">Track your order</h1>
        <p className="mt-3 text-lg text-muted-foreground">
          Enter your order number and the email you used at checkout to see your delivery status.
          No account needed.
        </p>
      </header>

      <div className="mt-8">
        <TrackOrderForm />
      </div>
    </div>
  );
}
