import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { CompetitorManager } from "@/components/admin/social/intelligence/competitor-manager";
import { getCompetitorsDetailed } from "@/lib/queries/intelligence";

export const metadata: Metadata = {
  title: "Competitor Watchlist",
  robots: { index: false },
};

export default async function CompetitorsPage() {
  const competitors = await getCompetitorsDetailed();
  return (
    <div>
      <PageHeader
        title="Competitor watchlist"
        description="Track public brand activity. Record observations in your own words — patterns, not wording."
      />
      <CompetitorManager competitors={competitors} />
    </div>
  );
}
