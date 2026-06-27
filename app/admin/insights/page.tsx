import type { Metadata } from "next";
import { Eye, ShoppingCart, Search, MousePointerClick, Users, Repeat } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { getInsights, type NamedCount } from "@/lib/queries/insights";

export const metadata: Metadata = { title: "AI Insights", robots: { index: false } };

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-center gap-2 text-xs font-medium uppercase text-muted-foreground">
        <Icon className="size-4 text-primary" /> {label}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
    </div>
  );
}

function RankedList({
  title,
  rows,
  unit,
  empty,
}: {
  title: string;
  rows: NamedCount[];
  unit: string;
  empty: string;
}) {
  return (
    <div className="rounded-xl border bg-background p-5">
      <h2 className="mb-4 font-semibold">{title}</h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ol className="space-y-2.5">
          {rows.map((r, i) => (
            <li key={r.id} className="flex items-center gap-3 text-sm">
              <span className="grid size-6 shrink-0 place-items-center rounded-full bg-accent text-xs font-semibold">
                {i + 1}
              </span>
              <span className="min-w-0 flex-1 truncate">{r.name}</span>
              <span className="shrink-0 font-medium text-muted-foreground">
                {r.count.toLocaleString("en-IN")} {unit}
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default async function AdminInsightsPage() {
  await guardSection("ai");
  const insights = await getInsights(30);
  const pct = (n: number) => `${Math.round(n * 100)}%`;
  // Click-through from a recommendation to a product view (directional signal).
  const recoCtr =
    insights.productViews > 0
      ? insights.recoClicks / insights.productViews
      : 0;

  return (
    <div>
      <PageHeader
        title="AI Insights"
        description={`Behavioral analytics from real shopper activity (last ${insights.windowDays} days).`}
      />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat icon={Eye} label="Product views" value={insights.productViews.toLocaleString("en-IN")} />
        <Stat icon={ShoppingCart} label="Cart adds" value={insights.cartAdds.toLocaleString("en-IN")} />
        <Stat icon={Search} label="Searches" value={insights.searches.toLocaleString("en-IN")} />
        <Stat icon={MousePointerClick} label="Reco clicks" value={insights.recoClicks.toLocaleString("en-IN")} />
        <Stat icon={Users} label="Returning customers" value={insights.returningCustomers.toLocaleString("en-IN")} />
        <Stat icon={Repeat} label="Repeat rate" value={pct(insights.repeatPurchaseRate)} />
      </div>

      <div className="mt-6 grid gap-4 lg:grid-cols-2">
        <RankedList
          title="Most viewed products"
          rows={insights.mostViewed}
          unit="views"
          empty="No product views recorded yet."
        />
        <RankedList
          title="Most purchased products"
          rows={insights.mostPurchased}
          unit="sold"
          empty="No paid orders in this window yet."
        />
        <RankedList
          title="Most added to cart"
          rows={insights.mostCartAdded}
          unit="adds"
          empty="No cart activity recorded yet."
        />

        <div className="rounded-xl border bg-background p-5">
          <h2 className="mb-4 font-semibold">Frequently bought together</h2>
          {insights.fbtPairs.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Not enough multi-item orders yet to surface pairs.
            </p>
          ) : (
            <ul className="space-y-2.5 text-sm">
              {insights.fbtPairs.map((p) => (
                <li key={`${p.a}|${p.b}`} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{p.a}</span>
                    <span className="text-muted-foreground"> + </span>
                    <span className="font-medium">{p.b}</span>
                  </span>
                  <span className="shrink-0 text-muted-foreground">{p.count}× together</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-xl border bg-background p-5">
          <h2 className="mb-4 font-semibold">Top searches</h2>
          {insights.topSearches.length === 0 ? (
            <p className="text-sm text-muted-foreground">No searches recorded yet.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {insights.topSearches.map((s) => (
                <span
                  key={s.query}
                  className="inline-flex items-center gap-1.5 rounded-full border bg-accent/40 px-3 py-1 text-sm"
                >
                  {s.query}
                  <span className="text-xs text-muted-foreground">{s.count}</span>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-background p-5">
          <h2 className="mb-4 font-semibold">Recommendation engagement</h2>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Recommendation clicks</dt>
              <dd className="font-medium">{insights.recoClicks.toLocaleString("en-IN")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Reco click-through (vs views)</dt>
              <dd className="font-medium">{pct(recoCtr)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Customers with orders</dt>
              <dd className="font-medium">{insights.customersWithOrders.toLocaleString("en-IN")}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Returning customers</dt>
              <dd className="font-medium">{insights.returningCustomers.toLocaleString("en-IN")}</dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-muted-foreground">
            Powered by the centralized recommendation service. Rule-based today;
            the same signals feed future ML / LLM models without UI changes.
          </p>
        </div>
      </div>
    </div>
  );
}
