import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { MarketingTabs } from "@/components/admin/marketing/marketing-tabs";
import { SegmentsManager, type SegmentRow } from "@/components/admin/marketing/segments-manager";
import { getSegments, getComposeData } from "@/lib/queries/marketing";

export const metadata: Metadata = { title: "Audience segments", robots: { index: false } };

export default async function MarketingSegmentsPage() {
  await guardSection("marketing");
  const [segments, data] = await Promise.all([getSegments(), getComposeData()]);

  const rows: SegmentRow[] = segments.map((s) => ({
    id: s.id,
    name: s.name,
    type: s.type,
    cachedCount: s.cachedCount,
    config: (s.config as SegmentRow["config"]) ?? null,
  }));

  return (
    <div>
      <PageHeader title="Audience segments" description="Reusable audiences for targeting" />
      <MarketingTabs />
      <SegmentsManager segments={rows} products={data.products} categories={data.categories} />
    </div>
  );
}
