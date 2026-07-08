import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { getSocialSettings } from "@/lib/social/settings";
import { SocialSettingsForm } from "@/components/admin/social/social-settings-form";

export const metadata: Metadata = { title: "Automation Settings", robots: { index: false } };

export default async function SocialSettingsPage() {
  const settings = await getSocialSettings();
  return (
    <div>
      <PageHeader
        title="Automation Settings"
        description="Global defaults for the AI Marketing planner and content generation."
      />
      <SocialSettingsForm settings={settings} />
    </div>
  );
}
