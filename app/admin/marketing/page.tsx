import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Send, MailCheck, Eye, MousePointerClick, ShoppingCart, IndianRupee, Megaphone } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MarketingTabs } from "@/components/admin/marketing/marketing-tabs";
import { PushSetupCard } from "@/components/admin/marketing/push-setup-card";
import { getMarketingOverview } from "@/lib/queries/marketing";
import { isConfigured } from "@/lib/env";
import { formatPrice, formatDate } from "@/lib/format";
import { STATUS_LABEL, STATUS_VARIANT } from "@/lib/marketing/channels";
import type { CampaignStatus } from "@prisma/client";

export const metadata: Metadata = { title: "Marketing Hub", robots: { index: false } };

function pct(n: number, d: number) {
  return d > 0 ? `${((n / d) * 100).toFixed(1)}%` : "—";
}

export default async function MarketingOverviewPage() {
  await guardSection("marketing");
  const { totals, recent } = await getMarketingOverview();

  const cards = [
    { label: "Messages sent", value: String(totals.sent), icon: Send },
    { label: "Delivered", value: String(totals.delivered), hint: pct(totals.delivered, totals.sent), icon: MailCheck },
    { label: "Opened", value: String(totals.opened), hint: pct(totals.opened, totals.delivered), icon: Eye },
    { label: "Clicked", value: String(totals.clicked), hint: pct(totals.clicked, totals.delivered), icon: MousePointerClick },
    { label: "Conversions", value: String(totals.conversions), hint: pct(totals.conversions, totals.clicked), icon: ShoppingCart },
    { label: "Revenue", value: formatPrice(totals.revenue), icon: IndianRupee },
  ];

  return (
    <div>
      <PageHeader title="Marketing Hub" description={`${totals.campaigns} campaign${totals.campaigns === 1 ? "" : "s"}`}>
        <Button asChild className="gap-1.5">
          <Link href="/admin/marketing/compose">
            <Plus className="size-4" /> New campaign
          </Link>
        </Button>
      </PageHeader>
      <MarketingTabs />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border p-4">
            <c.icon className="size-4 text-primary" />
            <p className="mt-2 text-xs text-muted-foreground">{c.label}</p>
            <p className="text-xl font-bold tabular-nums">{c.value}</p>
            {c.hint && <p className="text-[11px] text-muted-foreground">{c.hint}</p>}
          </div>
        ))}
      </div>

      {!isConfigured.webPush() && <PushSetupCard />}

      <div className="mt-6 rounded-2xl border">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">Recent campaigns</h2>
          <Link href="/admin/marketing/campaigns" className="text-sm text-primary hover:underline">
            View all
          </Link>
        </div>
        {recent.length === 0 ? (
          <div className="p-10 text-center">
            <Megaphone className="mx-auto size-10 text-muted-foreground/40" />
            <p className="mt-3 font-medium">No campaigns yet</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Create your first broadcast, email or coupon campaign.
            </p>
            <Button asChild className="mt-4 gap-1.5">
              <Link href="/admin/marketing/compose">
                <Plus className="size-4" /> New campaign
              </Link>
            </Button>
          </div>
        ) : (
          <ul className="divide-y">
            {recent.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div className="min-w-0">
                  <Link
                    href={c.status === "SENT" ? "/admin/marketing/campaigns" : `/admin/marketing/compose/${c.id}`}
                    className="font-medium hover:text-primary"
                  >
                    {c.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {c.title} · {formatDate(c.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  {c.status === "SENT" && (
                    <span className="text-muted-foreground">
                      {c.sentCount} sent · {c.openCount} opens · {c.clickCount} clicks
                    </span>
                  )}
                  <Badge variant={STATUS_VARIANT[c.status as CampaignStatus]}>
                    {STATUS_LABEL[c.status as CampaignStatus]}
                  </Badge>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
