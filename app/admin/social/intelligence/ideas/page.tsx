import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { IdeasBoard } from "@/components/admin/social/intelligence/ideas-board";
import { getContentIdeas } from "@/lib/queries/intelligence";
import { getIntelligenceSettings } from "@/lib/intelligence/settings";

export const metadata: Metadata = {
  title: "Content Ideas",
  robots: { index: false },
};

export default async function IdeasPage() {
  const [ideas, settings] = await Promise.all([getContentIdeas(), getIntelligenceSettings()]);
  return (
    <div>
      <PageHeader
        title="Content opportunities"
        description="Original, scored ideas from market research. Use one to draft a post — the copy is always written fresh."
      />
      <IdeasBoard ideas={ideas} minScore={settings.minIdeaScore} />
    </div>
  );
}
