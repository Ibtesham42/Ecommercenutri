import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { TrackOrderForm } from "@/components/storefront/track-order-form";
import { CONTENT_PAGE_CLASS, PageHeader, ReadingLayout } from "@/components/storefront/page-header";

export const metadata: Metadata = buildMetadata({
  title: "Track your order",
  description: "Check the status of your Nutriyet order with your order number and email.",
  path: "/track",
});

export default function TrackOrderPage() {
  return (
    <div className={CONTENT_PAGE_CLASS}>
      <PageHeader
        crumbs={[{ name: "Home", href: "/" }, { name: "Track Order" }]}
        eyebrow="Orders"
        title="Track your order"
        lede="Enter your order number and the email you used at checkout to see your delivery status. No account needed."
      />
      <ReadingLayout>
        <TrackOrderForm />
      </ReadingLayout>
    </div>
  );
}
