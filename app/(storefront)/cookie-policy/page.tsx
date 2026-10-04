import type { Metadata } from "next";
import { buildMetadata } from "@/lib/seo";
import { getLegalPage } from "@/lib/queries/content";
import { LegalPageView } from "@/components/storefront/legal-page-view";

export const metadata: Metadata = buildMetadata({
  title: "Cookie Policy",
  description: "How Nutriyet uses cookies and similar technologies on this website.",
  path: "/cookie-policy",
});

// Content is CMS-editable (ContentPage) — render per request.
export const dynamic = "force-dynamic";

export default async function CookiePolicyPage() {
  const page = await getLegalPage("cookie-policy");
  return <LegalPageView page={page} />;
}
