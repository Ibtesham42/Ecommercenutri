import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { getLegalPage } from "@/lib/queries/content";
import { LegalPageView } from "@/components/storefront/legal-page-view";

export const metadata: Metadata = buildMetadata({
  title: "Disclaimer",
  description: "Important information about product, nutrition and AI assistant content on Nutriyet.",
  path: "/disclaimer",
});

// Content is CMS-editable (ContentPage) — render per request.
export const dynamic = "force-dynamic";

export default async function DisclaimerPage() {
  const page = await getLegalPage("disclaimer");
  return <LegalPageView page={page} />;
}
