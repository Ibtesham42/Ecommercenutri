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
import { PageHeader } from "@/components/admin/page-header";
import { guardSection } from "@/lib/admin-guard";
import { Badge } from "@/components/ui/badge";
import { Sparkline, MiniBars } from "@/components/admin/insights/charts";
import { AskBox } from "@/components/admin/insights/ask-box";
import { getBusinessIntelligence, type RankRow, type Alert } from "@/lib/queries/bi";
import { generateBusinessSummary } from "@/lib/ai/insights";
import { formatPrice } from "@/lib/format";

export const metadata: Metadata = { title: "AI Insights", robots: { index: false } };

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

export default async function AdminInsightsPage() {
  await guardSection("ai");
  const bi = await getBusinessIntelligence();
  const summary = await generateBusinessSummary(bi);
  const s = bi.summary;

  const periodCards: { label: string; period: { revenue: number; orders: number }; growth?: number }[] = [
    { label: "Today", period: s.today },
    { label: "This week", period: s.week, growth: s.week.revenueGrowth },
    { label: "This month", period: s.month, growth: s.month.revenueGrowth },
    { label: "This year", period: s.year },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="AI Business Intelligence" description="Live insights, forecasts and recommendations from your store data" />

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
            format={(n) => formatPrice(n)}
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

      {/* Q&A */}
      <AskBox />
    </div>
  );
}
