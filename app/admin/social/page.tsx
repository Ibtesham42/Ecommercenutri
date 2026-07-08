import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";

export const metadata: Metadata = { title: "AI Marketing", robots: { index: false } };

export default async function AdminSocialPage() {
  await guardSection("social");
  return (
    <div>
      <PageHeader
        title="AI Marketing"
        description="Auto-generate and publish social content from your catalog."
      />
      <p className="text-sm text-muted-foreground">
        Setting up the AI Marketing Automation Hub…
      </p>
    </div>
  );
}
