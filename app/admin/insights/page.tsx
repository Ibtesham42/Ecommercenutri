import type { Metadata } from "next";
import {
  TrendingUp,
  TrendingDown,
  Sparkles,
  AlertTriangle,
  Info,
  CircleAlert,
  Users,
  Package,
  Megaphone,
  ShoppingCart,
  IndianRupee,
  CalendarClock,
  Boxes,
} from "lucide-react";
import { MapPin, Smartphone, Globe, Eye, RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { Badge } from "@/components/ui/badge";
import { Sparkline, MiniBars, FunnelChart, BreakdownBars } from "@/components/admin/insights/charts";
import { AskBox } from "@/components/admin/insights/ask-box";
import { KpiCard } from "@/components/admin/insights/kpi-card";
import { RangeFilter } from "@/components/admin/insights/range-filter";
import { LiveStrip } from "@/components/admin/insights/live-strip";
import { ActionPlanCard } from "@/components/admin/insights/action-plan";
import { getBusinessIntelligence, type RankRow, type Alert } from "@/lib/queries/bi";
import { getRangeAnalytics, type Kpi } from "@/lib/queries/analytics";
import { getJourneyAnalytics, type JourneyInput } from "@/lib/queries/journey";
import { getHeatmapAnalytics, getRageClicks, getSessionReplays } from "@/lib/queries/engagement";
import { getMarketingOverview } from "@/lib/queries/marketing";
import {
  generateBusinessSummary,
  generateActionPlan,
  generateJourneyDiagnosis,
  generateHeatmapInsights,
} from "@/lib/ai/insights";
import { JourneySection } from "@/components/admin/insights/journey-section";
import { HeatmapSection } from "@/components/admin/insights/heatmap-section";
import { RageSection } from "@/components/admin/insights/rage-section";
import { ReplaySection } from "@/components/admin/insights/replay-section";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "AI Insights", robots: { index: false } };

const nf = new Intl.NumberFormat("en-IN");

function kpiValue(k: Kpi): string {
  if (k.kind === "money") return formatPrice(k.value);
  if (k.kind === "pct") return `${k.value.toFixed(1)}%`;
  return nf.format(k.value);
}

/** Metrics where a falling number is good news (flips the delta chip color). */
const DOWN_IS_GOOD = new Set(["abandonment", "bounce"]);

/** Share-of-total bars for devices/sources/geo breakdowns. */
function breakdownItems(rows: RankRow[], money = false) {
  const total = rows.reduce((n, r) => n + r.value, 0) || 1;
  return rows.map((r) => ({
    label: r.name,
    pct: (r.value / total) * 100,
    valueLabel: `${money ? formatPrice(r.value) : nf.format(r.value)} · ${((r.value / total) * 100).toFixed(0)}%${r.sub ? ` · ${r.sub}` : ""}`,
  }));
}

function Growth({ pct }: { pct: number }) {
  const up = pct >= 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-primary" : "text-destructive"}`}>
      {up ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
      {up ? "+" : ""}
      {pct.toFixed(0)}%
    </span>
  );
}

function RankCard({
  title,
  icon: Icon,
  rows,
  money,
  empty,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  rows: RankRow[];
  money?: boolean;
  empty: string;
}) {
  return (
    <div className="rounded-2xl border bg-background p-5">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4 text-primary" /> {title}
      </h3>
      {rows.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {rows.map((r, i) => (
            <li key={r.id + i} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate">{r.name}</span>
              <span className="shrink-0 text-right">
                <span className="font-semibold tabular-nums">{money ? formatPrice(r.value) : r.value}</span>
                {r.sub && <span className="block text-[11px] text-muted-foreground">{r.sub}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

const ALERT_STYLE: Record<Alert["level"], { icon: React.ComponentType<{ className?: string }>; cls: string }> = {
  critical: { icon: CircleAlert, cls: "border-destructive/30 bg-destructive/5 text-destructive" },
  warning: { icon: AlertTriangle, cls: "border-amber-300/50 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400" },
  info: { icon: Info, cls: "border-primary/30 bg-primary/5 text-primary" },
};

export default async function AdminInsightsPage({
  searchParams,
}: {
  searchParams: Promise<JourneyInput>;
}) {
  await guardSection("ai");
  const sp = await searchParams;
  const [bi, ra, marketing, journey, heat, rage, replays] = await Promise.all([
    getBusinessIntelligence(),
    getRangeAnalytics(sp),
    getMarketingOverview().catch(() => null),
    getJourneyAnalytics(sp),
    getHeatmapAnalytics(sp),
    getRageClicks(sp),
    getSessionReplays().catch(() => []),
  ]);
  const [summary, plan, journeyDiagnosis, heatInsights] = await Promise.all([
    generateBusinessSummary(bi),
    generateActionPlan(bi, ra),
    generateJourneyDiagnosis(journey),
    generateHeatmapInsights(heat, rage.issues),
  ]);
  const s = bi.summary;

  const maxStage = Math.max(1, ra.funnel[0]?.count ?? 1);
  const funnelStages = ra.funnel.map((st) => ({
    label: st.label,
    countLabel: nf.format(st.count),
    widthPct: (st.count / maxStage) * 100,
    convLabel: st.convPct !== null ? `${st.convPct.toFixed(0)}% of previous` : undefined,
    dropLabel: st.dropPct !== null && st.dropPct > 0 ? `${st.dropPct.toFixed(0)}% drop` : undefined,
    deltaLabel: st.deltaPct !== null ? `${Math.abs(st.deltaPct).toFixed(0)}% vs prev` : undefined,
    deltaUp: st.deltaPct !== null ? st.deltaPct >= 0 : undefined,
    sub: st.sub,
    pending: st.pending,
  }));

  const bestCampaigns = (marketing?.recent ?? [])
    .filter((c) => c.status === "SENT")
    .sort((a, b) => b.clickCount - a.clickCount)
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      name: c.name,
      value: c.clickCount,
      sub: `${c.sentCount} sent · ${c.openCount} opens`,
    }));

  const periodCards: { label: string; period: { revenue: number; orders: number }; growth?: number }[] = [
    { label: "Today", period: s.today },
    { label: "This week", period: s.week, growth: s.week.revenueGrowth },
    { label: "This month", period: s.month, growth: s.month.revenueGrowth },
    { label: "This year", period: s.year },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="AI Business Intelligence" description="Live insights, forecasts and recommendations from your store data" />

      {/* Range filter + report downloads (scopes the new analytics sections) */}
      <RangeFilter range={ra.range} />

      {/* AI summary */}
      <div className="rounded-2xl border bg-gradient-to-br from-primary/10 to-transparent p-5">
        <div className="mb-2 flex items-center gap-2">
          <Sparkles className="size-4 text-primary" />
          <h2 className="font-semibold">Business summary</h2>
          <Badge variant={summary.ai ? "default" : "secondary"} className="text-[10px]">
            {summary.ai ? "AI" : "Auto"}
          </Badge>
        </div>
        <p className="text-sm leading-relaxed">{summary.text}</p>
      </div>

      {/* AI action plan (range-aware) */}
      <ActionPlanCard plan={plan} />

      {/* Smart alerts */}
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {bi.alerts.map((a, i) => {
          const st = ALERT_STYLE[a.level];
          return (
            <div key={i} className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${st.cls}`}>
              <st.icon className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-xs opacity-90">{a.detail}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-time strip */}
      <LiveStrip />

      {/* KPI grid (selected range) */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          Key metrics <span className="text-xs font-normal text-muted-foreground">· {ra.range.label}</span>
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {ra.kpis.map((k) => (
            <KpiCard
              key={k.key}
              label={k.label}
              value={kpiValue(k)}
              deltaPct={k.deltaPct}
              invertDelta={DOWN_IS_GOOD.has(k.key)}
              series={k.series}
              note={k.note}
            />
          ))}
        </div>
      </section>

      {/* Conversion funnel (selected range) */}
      <section className="rounded-2xl border bg-background p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          Conversion funnel <span className="text-xs font-normal text-muted-foreground">· {ra.range.label}</span>
        </h2>
        {funnelStages.length === 0 || (ra.funnel[0]?.count ?? 0) === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No shopper activity in this period yet — the funnel fills in as visitors browse, add to cart and order.
          </p>
        ) : (
          <FunnelChart stages={funnelStages} />
        )}
      </section>

      {/* Sales summary */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {periodCards.map((c) => (
          <div key={c.label} className="rounded-2xl border bg-background p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-xl font-bold tabular-nums">{formatPrice(c.period.revenue)}</p>
            <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{c.period.orders} orders</span>
              {c.growth !== undefined && <Growth pct={c.growth} />}
            </div>
          </div>
        ))}
      </div>

      {/* Trend + forecast */}
      <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border bg-background p-5">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <IndianRupee className="size-4 text-primary" /> Revenue — last 30 days
            </h3>
            <span className="hidden text-xs text-muted-foreground sm:inline">hover bars for daily totals</span>
          </div>
          <MiniBars
            data={bi.trend.map((t) => t.revenue)}
            labels={bi.trend.map((t) => t.date.slice(5))}
            valueLabels={bi.trend.map((t) => formatPrice(t.revenue))}
          />
        </div>
        <div className="rounded-2xl border bg-background p-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <CalendarClock className="size-4 text-primary" /> This month&apos;s forecast
          </h3>
          <p className="text-2xl font-bold tabular-nums">{formatPrice(bi.forecast.monthProjected)}</p>
          <p className="text-xs text-muted-foreground">
            projected · {formatPrice(bi.forecast.monthSoFar)} so far (day {bi.forecast.daysElapsed}/{bi.forecast.daysInMonth})
          </p>
          <div className="mt-3 text-sm">
            <span className="text-muted-foreground">Run-rate: </span>
            <span className="font-medium">{formatPrice(bi.forecast.runRatePerDay)}/day</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Best time to promote: <span className="font-medium text-foreground">{bi.bestTime.day}</span> around{" "}
            <span className="font-medium text-foreground">{bi.bestTime.hour}</span>
          </p>
        </div>
      </div>

      {/* Customers */}
      <div className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <div className="rounded-2xl border bg-background p-5">
          <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <Users className="size-4 text-primary" /> Customer segments
          </h3>
          <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            {[
              { label: "Total", value: bi.customers.total },
              { label: "New (30d)", value: bi.customers.new },
              { label: "Returning", value: bi.customers.returning },
              { label: "High-value", value: bi.customers.highValue },
              { label: "Inactive", value: bi.customers.inactive },
              { label: "Repeat rate", value: `${bi.customers.repeatRate.toFixed(0)}%` },
            ].map((m) => (
              <div key={m.label} className="rounded-xl border p-3">
                <p className="text-lg font-bold tabular-nums">{m.value}</p>
                <p className="text-[11px] text-muted-foreground">{m.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4">
            <p className="mb-1 text-xs text-muted-foreground">New customers — last 14 days</p>
            <Sparkline data={bi.customers.newPerDay.map((d) => d.count)} />
          </div>
        </div>
        <RankCard title="Top customers" icon={Users} rows={bi.customers.topCustomers} money empty="No customers with orders yet." />
      </div>

      {/* Inventory */}
      <div className="rounded-2xl border bg-background p-5">
        <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
          <Boxes className="size-4 text-primary" /> Inventory forecast
          <span className="ml-2 text-xs font-normal text-muted-foreground">
            {bi.inventory.outOfStock} out of stock · {bi.inventory.lowStock} low
          </span>
        </h3>
        {bi.inventory.predictedStockouts.length === 0 ? (
          <p className="py-4 text-center text-xs text-muted-foreground">No imminent stockouts predicted.</p>
        ) : (
          <ul className="space-y-2 text-sm">
            {bi.inventory.predictedStockouts.map((v) => (
              <li key={v.id} className="flex items-center justify-between gap-3">
                <span className="min-w-0 truncate">{v.name}</span>
                <span className="shrink-0 text-right text-xs">
                  <span className="font-semibold text-amber-600">~{v.daysLeft}d left</span>
                  <span className="block text-muted-foreground">{v.stock} in stock · {v.perDay}/day</span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Products */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <RankCard title="Trending up" icon={TrendingUp} rows={bi.products.trending} empty="No risers yet." />
        <RankCard title="Declining" icon={TrendingDown} rows={bi.products.declining} empty="No decliners." />
        <RankCard title="Best by category" icon={Package} rows={bi.products.bestByCategory} empty="No sales yet." />
        <RankCard title="Worth promoting" icon={Megaphone} rows={bi.products.promote} empty="Nothing flagged." />
      </div>

      {/* Top products (selected range) */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          Top products <span className="text-xs font-normal text-muted-foreground">· {ra.range.label}</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <RankCard title="Most viewed" icon={Eye} rows={ra.topProducts.mostViewed} empty="No product views in this period." />
          <RankCard title="Most added to cart" icon={ShoppingCart} rows={ra.topProducts.mostCartAdded} empty="No cart adds in this period." />
          <RankCard title="Most purchased" icon={Package} rows={ra.topProducts.mostPurchased} empty="No sales in this period." />
          <RankCard title="Highest revenue" icon={IndianRupee} rows={ra.topProducts.highestRevenue} money empty="No sales in this period." />
          <RankCard title="Lowest conversion" icon={TrendingDown} rows={ra.topProducts.lowestConversion} empty="No product with 10+ views converting poorly." />
        </div>
      </section>

      {/* Customer insights (selected range) */}
      <section>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          Customer insights <span className="text-xs font-normal text-muted-foreground">· {ra.range.label}</span>
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border bg-background p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <MapPin className="size-4 text-primary" /> Top cities
            </h3>
            {ra.geo.cities.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No orders in this period yet.</p>
            ) : (
              <BreakdownBars items={breakdownItems(ra.geo.cities, true)} />
            )}
          </div>
          <div className="rounded-2xl border bg-background p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <MapPin className="size-4 text-primary" /> Top states
            </h3>
            {ra.geo.states.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">No orders in this period yet.</p>
            ) : (
              <BreakdownBars items={breakdownItems(ra.geo.states, true)} />
            )}
          </div>
          <div className="rounded-2xl border bg-background p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Smartphone className="size-4 text-primary" /> Devices
            </h3>
            {ra.devices.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Data appears here as new visits are tracked.
              </p>
            ) : (
              <BreakdownBars items={breakdownItems(ra.devices)} />
            )}
          </div>
          <div className="rounded-2xl border bg-background p-5">
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <Globe className="size-4 text-primary" /> Traffic sources
            </h3>
            {ra.sources.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                Data appears here as new visits are tracked.
              </p>
            ) : (
              <BreakdownBars items={breakdownItems(ra.sources)} />
            )}
          </div>
          <RankCard title="Best campaigns (clicks)" icon={Megaphone} rows={bestCampaigns} empty="No sent campaigns yet." />
          <div className="rounded-2xl border bg-background p-5">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
              <RotateCcw className="size-4 text-primary" /> Cart recovery
            </h3>
            {ra.recovery.logs === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">
                No abandoned-cart automation activity in this period. Enable it under Marketing → Automations.
              </p>
            ) : (
              <>
                <p className="text-2xl font-bold tabular-nums">{ra.recovery.recoveredCarts}</p>
                <p className="text-xs text-muted-foreground">
                  carts recovered from {ra.recovery.logs} reminder{ra.recovery.logs === 1 ? "" : "s"} ·{" "}
                  {((ra.recovery.recoveredCarts / ra.recovery.logs) * 100).toFixed(0)}% recovery rate
                </p>
                <p className="mt-2 text-sm">
                  <span className="text-muted-foreground">Recovered revenue: </span>
                  <span className="font-semibold">{formatPrice(ra.recovery.recoveredRevenue)}</span>
                </p>
              </>
            )}
          </div>
        </div>
      </section>

      {/* Cart + affiliates + campaigns */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="rounded-2xl border bg-background p-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="size-4 text-primary" /> Cart abandonment
          </h3>
          <p className="text-2xl font-bold tabular-nums">{bi.cart.abandonmentRate.toFixed(0)}%</p>
          <p className="text-xs text-muted-foreground">
            {bi.cart.cartAdds30d} cart-adds → {bi.cart.purchases30d} purchases (30d) · {bi.cart.abandonedCarts} active carts
          </p>
          {bi.cart.abandonmentRate >= 50 && bi.cart.cartAdds30d >= 10 && (
            <p className="mt-2 text-xs text-amber-600">Tip: run an abandoned-cart recovery campaign.</p>
          )}
        </div>
        <RankCard title="Top affiliates (90d)" icon={Megaphone} rows={bi.affiliates.top} money empty="No affiliate sales yet." />
        <div className="rounded-2xl border bg-background p-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
            <Sparkles className="size-4 text-primary" /> Campaign performance
          </h3>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div><p className="text-lg font-bold tabular-nums">{bi.campaigns.sent}</p><p className="text-[11px] text-muted-foreground">sent</p></div>
            <div><p className="text-lg font-bold tabular-nums">{bi.campaigns.openRate.toFixed(0)}%</p><p className="text-[11px] text-muted-foreground">open rate</p></div>
            <div><p className="text-lg font-bold tabular-nums">{bi.campaigns.clickRate.toFixed(0)}%</p><p className="text-[11px] text-muted-foreground">click rate</p></div>
            <div><p className="text-lg font-bold tabular-nums">{bi.campaigns.conversions}</p><p className="text-[11px] text-muted-foreground">conversions</p></div>
          </div>
          {bi.campaigns.revenue > 0 && (
            <p className="mt-2 text-xs text-muted-foreground">Attributed revenue: <span className="font-medium text-foreground">{formatPrice(bi.campaigns.revenue)}</span></p>
          )}
        </div>
      </div>

      {/* Customer journey analytics (selected range + filters) */}
      <JourneySection journey={journey} diagnosis={journeyDiagnosis} />

      {/* Website heatmap analytics */}
      <HeatmapSection heat={heat} insights={heatInsights} />

      {/* Rage-click detection */}
      <RageSection issues={rage.issues} total={rage.total} />

      {/* Session replay */}
      <ReplaySection replays={replays} />

      {/* Q&A */}
      <AskBox />
    </div>
  );
}
