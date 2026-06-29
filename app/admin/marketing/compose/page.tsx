import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { MarketingTabs } from "@/components/admin/marketing/marketing-tabs";
import { CampaignEditor } from "@/components/admin/marketing/campaign-editor";
import { getComposeData } from "@/lib/queries/marketing";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "New campaign", robots: { index: false } };

export default async function ComposeNewPage() {
  await guardSection("marketing");
  const { products, coupons, categories, segments, templates } = await getComposeData();

  return (
    <div>
      <PageHeader title="New campaign" description="Compose, target and send" />
      <MarketingTabs />
      <CampaignEditor
        campaign={null}
        products={products}
        coupons={coupons}
        categories={categories}
        templates={templates}
        segments={segments}
        cloudinaryReady={isConfigured.cloudinary()}
      />
    </div>
  );
}
