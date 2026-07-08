import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { getSocialTemplates } from "@/lib/queries/social";
import { TemplatesManager } from "@/components/admin/social/templates-manager";

export const metadata: Metadata = { title: "Templates", robots: { index: false } };

export default async function SocialTemplatesPage() {
  const templates = await getSocialTemplates();
  return (
    <div>
      <PageHeader
        title="Templates"
        description="Per-pillar prompt guidance that steers how posts are written."
      />
      <TemplatesManager templates={templates} />
    </div>
  );
}
