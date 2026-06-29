import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MarketingTabs } from "@/components/admin/marketing/marketing-tabs";
import { CampaignList, type CampaignRow } from "@/components/admin/marketing/campaign-list";
import { getCampaigns } from "@/lib/queries/marketing";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Campaigns", robots: { index: false } };

const FILTERS = [
  { label: "All", value: "" },
  { label: "Draft", value: "DRAFT" },
  { label: "Scheduled", value: "SCHEDULED" },
  { label: "Sent", value: "SENT" },
  { label: "Cancelled", value: "CANCELLED" },
];

export default async function MarketingCampaignsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  await guardSection("marketing");
  const { status = "", q = "" } = await searchParams;
  const campaigns = await getCampaigns({ status, q });

  const rows: CampaignRow[] = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    title: c.title,
    status: c.status,
    channels: c.channels,
    audienceSize: c.audienceSize,
    sentCount: c.sentCount,
    deliveredCount: c.deliveredCount,
    openCount: c.openCount,
    clickCount: c.clickCount,
    conversionCount: c.conversionCount,
    revenue: c.revenue,
    recurrence: c.recurrence,
    scheduledFor: c.scheduledFor ? c.scheduledFor.toISOString() : null,
    sentAt: c.sentAt ? c.sentAt.toISOString() : null,
    createdAt: c.createdAt.toISOString(),
  }));

  return (
    <div>
      <PageHeader title="Campaigns" description={`${campaigns.length} campaign${campaigns.length === 1 ? "" : "s"}`}>
        <Button asChild className="gap-1.5">
          <Link href="/admin/marketing/compose">
            <Plus className="size-4" /> New campaign
          </Link>
        </Button>
      </PageHeader>
      <MarketingTabs />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/marketing/campaigns${f.value ? `?status=${f.value}` : ""}`}
            className={cn(
              "rounded-full border px-3 py-1 text-sm transition hover:bg-accent",
              status === f.value && "border-primary bg-primary/10 text-primary",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <form action="/admin/marketing/campaigns" className="mb-4 max-w-sm">
        {status && <input type="hidden" name="status" value={status} />}
        <Input name="q" placeholder="Search campaigns…" defaultValue={q} />
      </form>

      <CampaignList campaigns={rows} />
    </div>
  );
}
