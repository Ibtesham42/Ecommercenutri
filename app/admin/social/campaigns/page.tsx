import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { getSocialCampaigns, getSocialProductOptions } from "@/lib/queries/social";
import { CampaignEditor } from "@/components/admin/social/campaign-editor";

export const metadata: Metadata = { title: "Campaigns", robots: { index: false } };

export default async function SocialCampaignsPage() {
  const [campaigns, products] = await Promise.all([
    getSocialCampaigns(),
    getSocialProductOptions(),
  ]);
  return (
    <div>
      <PageHeader
        title="Campaign Manager"
        description="Pick products, a schedule and a publish mode. The planner does the rest."
      />
      <CampaignEditor campaigns={campaigns} products={products} />
    </div>
  );
}
