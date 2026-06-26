import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { getLegalPage } from "@/lib/queries/content";
import { LegalPageView } from "@/components/storefront/legal-page-view";

export const metadata: Metadata = buildMetadata({
  title: "Shipping & Returns",
  description: "Delivery timelines, free-shipping threshold, and our return policy.",
  path: "/shipping",
});

// Content is CMS-editable (ContentPage) — render per request.
export const dynamic = "force-dynamic";

export default async function ShippingPage() {
  const page = await getLegalPage("shipping");
  return <LegalPageView page={page} />;
}
