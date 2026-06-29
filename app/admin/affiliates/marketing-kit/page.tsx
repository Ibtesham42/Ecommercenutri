import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { AffiliateTabs } from "@/components/admin/affiliate-tabs";
import { MarketingKitManager } from "@/components/admin/marketing-kit-manager";
import { getMarketingAssets } from "@/lib/queries/affiliate";
import { isConfigured } from "@/lib/env";

export const metadata: Metadata = { title: "Marketing kit", robots: { index: false } };

export default async function MarketingKitPage() {
  await guardSection("affiliates");
  const assets = await getMarketingAssets(false);

  return (
    <div>
      <PageHeader
        title="Marketing kit"
        description="Assets affiliates can preview and download from their dashboard."
      />
      <AffiliateTabs />
      <MarketingKitManager
        assets={assets.map((a) => ({
          id: a.id,
          title: a.title,
          type: a.type,
          fileUrl: a.fileUrl,
          thumbnailUrl: a.thumbnailUrl,
          isActive: a.isActive,
        }))}
        cloudinaryReady={isConfigured.cloudinary()}
      />
    </div>
  );
}
