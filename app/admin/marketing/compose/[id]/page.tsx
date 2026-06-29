import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { MarketingTabs } from "@/components/admin/marketing/marketing-tabs";
import { CampaignEditor, type EditorCampaign } from "@/components/admin/marketing/campaign-editor";
import { getCampaign, getComposeData } from "@/lib/queries/marketing";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Edit campaign", robots: { index: false } };

export default async function ComposeEditPage({ params }: { params: Promise<{ id: string }> }) {
  await guardSection("marketing");
  const { id } = await params;
  const [campaign, data] = await Promise.all([getCampaign(id), getComposeData()]);
  if (!campaign) notFound();
  // Sent / sending campaigns are immutable — view them on the campaigns list.
  if (campaign.status === "SENT" || campaign.status === "SENDING") {
    redirect("/admin/marketing/campaigns");
  }

  const editor: EditorCampaign = {
    id: campaign.id,
    name: campaign.name,
    channels: campaign.channels,
    title: campaign.title,
    body: campaign.body,
    imageUrl: campaign.imageUrl,
    ctaText: campaign.ctaText,
    ctaUrl: campaign.ctaUrl,
    segmentType: campaign.segmentType,
    segmentConfig: (campaign.segmentConfig as EditorCampaign["segmentConfig"]) ?? null,
    productId: campaign.productId,
    couponId: campaign.couponId,
    recurrence: campaign.recurrence,
  };

  return (
    <div>
      <PageHeader title="Edit campaign" description={campaign.name} />
      <MarketingTabs />
      <CampaignEditor
        campaign={editor}
        products={data.products}
        coupons={data.coupons}
        categories={data.categories}
        templates={data.templates}
        segments={data.segments}
        channelConfig={data.channelConfig}
        cloudinaryReady={isConfigured.cloudinary()}
      />
    </div>
  );
}
