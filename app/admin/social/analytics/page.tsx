import type { Metadata } from "next";
import { PageHeader } from "@/components/admin/page-header";
import { getSocialAnalytics } from "@/lib/queries/social";
import { PILLAR_LABEL } from "@/lib/social/strategy";
import type { Pillar } from "@/lib/social/strategy";
import { StatCard as Stat } from "@/components/admin/social/stat-card";
import { CheckCircle2, AlertTriangle, Gauge, Package, RotateCw } from "lucide-react";

export const metadata: Metadata = { title: "Analytics", robots: { index: false } };

export default async function SocialAnalyticsPage() {
  const a = await getSocialAnalytics();
  const bestPillar = [...a.byPillar].sort((x, y) => y.count - x.count)[0];
  const bestDaypart = [...a.byDaypart].sort((x, y) => y.count - x.count)[0];

  return (
    <div>
      <PageHeader title="Analytics" description="How your automated content is performing." />

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
        <Stat label="Published" value={a.totalPublished} icon={CheckCircle2} />
        <Stat label="Failed" value={a.totalFailed} icon={AlertTriangle} />
        <Stat label="Success rate" value={`${a.successRate}%`} icon={Gauge} />
        <Stat label="Auto-retries" value={a.totalRetries} icon={RotateCw} hint="on failure" />
        <Stat label="Promoted" value={a.topProducts.length} icon={Package} hint="products" />
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border p-4 shadow-elev-1">
          <p className="mb-1 text-sm font-semibold text-muted-foreground">Best posting time</p>
          <p className="text-lg font-medium">
            {bestDaypart ? (bestDaypart.daypart === "MORNING" ? "Mornings" : "Evenings") : "—"}
          </p>
        </div>
        <div className="rounded-xl border p-4 shadow-elev-1">
          <p className="mb-1 text-sm font-semibold text-muted-foreground">Best-performing pillar</p>
          <p className="text-lg font-medium">
            {bestPillar ? PILLAR_LABEL[bestPillar.pillar as Pillar] : "—"}
          </p>
        </div>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <div className="rounded-xl border p-4 shadow-elev-1">
          <p className="mb-3 text-sm font-semibold">Published by pillar</p>
          {a.byPillar.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {[...a.byPillar]
                .sort((x, y) => y.count - x.count)
                .map((row) => (
                  <div key={row.pillar} className="flex items-center gap-2 text-sm">
                    <span className="w-40 shrink-0 truncate">{PILLAR_LABEL[row.pillar as Pillar]}</span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{ width: `${Math.round((row.count / a.totalPublished) * 100) || 0}%` }}
                      />
                    </div>
                    <span className="w-6 text-right text-xs text-muted-foreground">{row.count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border p-4 shadow-elev-1">
          <p className="mb-3 text-sm font-semibold">Top promoted products</p>
          {a.topProducts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No data yet.</p>
          ) : (
            <div className="space-y-2">
              {a.topProducts.map((p) => (
                <div key={p.productId} className="flex items-center justify-between text-sm">
                  <span className="truncate">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.count} post(s)</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border p-4 shadow-elev-1">
        <p className="mb-3 text-sm font-semibold">Engagement (where available)</p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <Stat label="Reach" value={a.engagement.reach} />
          <Stat label="Impressions" value={a.engagement.impressions} />
          <Stat label="Likes" value={a.engagement.likes} />
          <Stat label="Comments" value={a.engagement.comments} />
          <Stat label="Clicks" value={a.engagement.clicks} />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Populated after publishing once Instagram is connected and insights are fetched.
        </p>
      </div>
    </div>
  );
}
