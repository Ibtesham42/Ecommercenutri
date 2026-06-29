import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { MarketingTabs } from "@/components/admin/marketing/marketing-tabs";
import { TemplatesManager, type TemplateRow } from "@/components/admin/marketing/templates-manager";
import { getTemplates } from "@/lib/queries/marketing";

export const metadata: Metadata = { title: "Campaign templates", robots: { index: false } };

export default async function MarketingTemplatesPage() {
  await guardSection("marketing");
  const templates = await getTemplates();

  const rows: TemplateRow[] = templates.map((t) => ({
    id: t.id,
    name: t.name,
    category: t.category,
    channels: t.channels,
    title: t.title,
    body: t.body,
    ctaText: t.ctaText,
    isBuiltIn: t.isBuiltIn,
  }));

  return (
    <div>
      <PageHeader title="Campaign templates" description="Reusable starting points" />
      <MarketingTabs />
      <TemplatesManager templates={rows} />
    </div>
  );
}
