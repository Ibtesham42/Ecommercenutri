import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { getLegalPage } from "@/lib/queries/content";
import { LegalPageView } from "@/components/storefront/legal-page-view";

export const metadata: Metadata = buildMetadata({
  title: "Terms of Service",
  description: "The terms that govern your use of Nutriyet and your purchases.",
  path: "/terms",
});

// Content is CMS-editable (ContentPage) — render per request.
export const dynamic = "force-dynamic";

export default async function TermsPage() {
  const page = await getLegalPage("terms");
  return <LegalPageView page={page} />;
}
