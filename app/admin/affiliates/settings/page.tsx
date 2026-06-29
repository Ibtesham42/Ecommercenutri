import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { AffiliateTabs } from "@/components/admin/affiliate-tabs";
import { AffiliateSettingsForm } from "@/components/admin/affiliate-settings-form";
import { getAffiliateSettings } from "@/lib/queries/settings";

export const metadata: Metadata = { title: "Affiliate settings", robots: { index: false } };

export default async function AffiliateSettingsPage() {
  await guardSection("affiliates");
  const s = await getAffiliateSettings();

  return (
    <div>
      <PageHeader title="Affiliate settings" description="Program defaults and attribution." />
      <AffiliateTabs />
      <AffiliateSettingsForm
        initial={{
          affiliateEnabled: s.affiliateEnabled,
          affiliateCookieDays: s.affiliateCookieDays,
          affiliateDefaultCommissionType: s.affiliateDefaultCommissionType,
          defaultValue:
            s.affiliateDefaultCommissionType === "FIXED"
              ? s.affiliateDefaultCommissionValue / 100
              : s.affiliateDefaultCommissionValue,
          minPayoutRupees: s.affiliateMinPayout / 100,
        }}
      />
    </div>
  );
}
