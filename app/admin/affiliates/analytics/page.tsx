import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { AffiliateTabs } from "@/components/admin/affiliate-tabs";
import { getAffiliateAnalytics } from "@/lib/queries/affiliate";
import { formatPrice } from "@/lib/format";
import { AFFILIATE_ROLE_LABEL } from "@/lib/affiliate/labels";

export const metadata: Metadata = { title: "Affiliate analytics", robots: { index: false } };

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

type Row = {
  code: string;
  displayName: string;
  role: string;
  couponCode: string | null;
  couponUses: number;
  revenue: number;
  commission: number;
  clicks: number;
  orders: number;
  conversion: number;
};

function Leaderboard({
  title,
  rows,
  metric,
}: {
  title: string;
  rows: Row[];
  metric: (r: Row) => string;
}) {
  return (
    <div className="rounded-2xl border p-5">
      <h2 className="mb-3 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">No data yet.</p>
      ) : (
        <ol className="space-y-1.5 text-sm">
          {rows.map((r, i) => (
            <li key={r.code} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">
                <span className="mr-2 text-muted-foreground">{i + 1}.</span>
                {r.displayName}
                <span className="ml-1 text-xs text-muted-foreground">
                  ({AFFILIATE_ROLE_LABEL[r.role as keyof typeof AFFILIATE_ROLE_LABEL]})
                </span>
              </span>
              <span className="shrink-0 font-semibold">{metric(r)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default async function AffiliateAnalyticsPage() {
  await guardSection("affiliates");
  const a = await getAffiliateAnalytics();

  return (
    <div>
      <PageHeader title="Affiliate analytics" description="Program-wide performance." />
      <AffiliateTabs />

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Active affiliates" value={String(a.totals.activeAffiliates)} />
        <Stat label="Referral clicks" value={String(a.totals.clicks)} />
        <Stat label="Referred orders" value={String(a.totals.orders)} />
        <Stat label="Revenue" value={formatPrice(a.totals.revenue)} />
        <Stat label="Total commission" value={formatPrice(a.totals.commission)} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Leaderboard title="Top affiliates by commission" rows={a.topByCommission} metric={(r) => formatPrice(r.commission)} />
        <Leaderboard title="Highest revenue" rows={a.topByRevenue} metric={(r) => formatPrice(r.revenue)} />
        <Leaderboard
          title="Best conversion (≥5 clicks)"
          rows={a.topByConversion}
          metric={(r) => `${(r.conversion * 100).toFixed(1)}% (${r.orders}/${r.clicks})`}
        />
        <Leaderboard
          title="Coupon performance"
          rows={a.couponPerformance}
          metric={(r) => `${r.couponCode} · ${r.couponUses} uses`}
        />
      </div>
    </div>
  );
}
