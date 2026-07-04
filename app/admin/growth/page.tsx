import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { GrowthManager } from "@/components/admin/growth-manager";
import { getGrowthSettings } from "@/lib/growth-settings";

export const metadata: Metadata = { title: "Growth", robots: { index: false } };

export default async function AdminGrowthPage() {
  await guardSection("appearance");
  const settings = await getGrowthSettings();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Growth &amp; conversion"
        description="Control the Health Score quiz, welcome popup, sticky offer bar, trust section and the shared welcome coupon. Everything is additive — turn any of it off and the storefront is unchanged."
      />
      <GrowthManager initial={settings} />
    </div>
  );
}
