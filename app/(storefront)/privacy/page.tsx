import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { getLegalPage } from "@/lib/queries/content";
import { LegalPageView } from "@/components/storefront/legal-page-view";

export const metadata: Metadata = buildMetadata({
  title: "Privacy Policy",
  description: "How Nutriyet collects, uses and protects your information.",
  path: "/privacy",
});

// Content is CMS-editable (ContentPage) — render per request.
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const page = await getLegalPage("privacy");
  return <LegalPageView page={page} />;
}
