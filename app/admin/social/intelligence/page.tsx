import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/admin/page-header";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/admin/social/stat-card";
import { IntelActionBar } from "@/components/admin/social/intelligence/intel-action-bar";
import { TrendHeatmap } from "@/components/admin/social/intelligence/trend-heatmap";
import { getIntelligenceOverview } from "@/lib/queries/intelligence";
import { PRIORITY_LABEL } from "@/lib/intelligence/catalog";
import {
  Users,
  Radar,
  Lightbulb,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  CalendarHeart,
  Target,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Competitor Intelligence",
  robots: { index: false },
};

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-elev-1">
      <div className="border-b px-4 py-2.5">
        <span className="text-sm font-semibold">{title}</span>
        {subtitle && <span className="ml-2 text-xs text-muted-foreground">{subtitle}</span>}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function ChipRow({ label, items }: { label: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <div>
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {items.map((i) => (
          <Badge key={i} variant="secondary" className="font-normal">
            {i}
          </Badge>
        ))}
      </div>
    </div>
  );
}

const MOMENTUM_ICON = {
  rising: TrendingUp,
  steady: Minus,
  cooling: TrendingDown,
} as const;

export default async function IntelligencePage() {
  const o = await getIntelligenceOverview();
  const activeCompetitors = o.competitors.filter((c) => c.active);
  const totalSignals = o.competitors.reduce((a, c) => a + c.signalCount, 0);
  const recommended = o.todaysIdeas.filter((i) => i.totalScore >= o.settings.minIdeaScore);
  const lastRun = o.weekly?.generatedAt ?? o.gaps?.generatedAt ?? null;

  return (
    <div>
      <PageHeader
        title="Competitor Intelligence"
        description="Learn from the market — trends, gaps and original content opportunities. Never copies."
      >
        <IntelActionBar settings={o.settings} />
      </PageHeader>

      {!o.settings.enabled && (
        <div className="mb-4 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
          Automated research is turned off. Reports won&apos;t refresh on schedule until you enable
          it in settings (gear icon above).
        </div>
      )}
      {!o.aiConfigured && (
        <div className="mb-4 rounded-xl border border-dashed p-3 text-sm text-muted-foreground">
          AI isn&apos;t configured (no Groq key) — insights use a built-in analyst baseline until a
          key is added.
        </div>
      )}

      <div className="mb-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <StatCard label="Competitors" value={activeCompetitors.length} icon={Users} hint={`${o.competitors.length} tracked`} />
        <StatCard label="Signals" value={totalSignals} icon={Radar} hint="public observations" />
        <StatCard label="Ideas today" value={o.todaysIdeas.length} icon={Lightbulb} hint={`${recommended.length} recommended`} />
        <StatCard
          label="Last analysis"
          value={lastRun ? new Date(lastRun).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : "—"}
          icon={Sparkles}
          hint={lastRun ? undefined : "not run yet"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Weekly insights */}
        <SectionCard
          title="This week"
          subtitle={o.weekly ? `refreshed ${new Date(o.weekly.generatedAt).toLocaleDateString("en-IN")}` : undefined}
        >
          {o.weekly ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{o.weekly.summary}</p>
              <div className="space-y-1.5">
                {o.weekly.data.trendingTopics.slice(0, 6).map((t) => {
                  const Icon = MOMENTUM_ICON[t.momentum];
                  return (
                    <div key={t.topic} className="flex items-start gap-2 text-sm">
                      <Icon
                        className={
                          t.momentum === "rising"
                            ? "mt-0.5 size-4 shrink-0 text-primary"
                            : "mt-0.5 size-4 shrink-0 text-muted-foreground"
                        }
                        aria-label={t.momentum}
                      />
                      <span>
                        <span className="font-medium">{t.topic}</span>
                        {t.note && <span className="text-muted-foreground"> — {t.note}</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No weekly report yet — run the analysis to generate one.
            </p>
          )}
        </SectionCard>

        {/* Monthly insights */}
        <SectionCard
          title="This month"
          subtitle={o.monthly ? `refreshed ${new Date(o.monthly.generatedAt).toLocaleDateString("en-IN")}` : undefined}
        >
          {o.monthly ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{o.monthly.summary}</p>
              <ChipRow label="Most discussed ingredients" items={o.monthly.data.ingredients.slice(0, 8)} />
              <ChipRow label="Health concerns" items={o.monthly.data.healthConcerns.slice(0, 6)} />
              <ChipRow label="Popular snack categories" items={o.monthly.data.snackCategories.slice(0, 6)} />
              <ChipRow label="Emerging topics" items={o.monthly.data.emergingTopics.slice(0, 6)} />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No monthly report yet — run the analysis to generate one.
            </p>
          )}
        </SectionCard>
      </div>

      {/* Seasonal + festivals */}
      {(o.weekly?.data.festivals.length || o.weekly?.data.seasonal.length) ? (
        <div className="mt-4">
          <SectionCard title="Seasonal & festival opportunities">
            <div className="grid gap-3 sm:grid-cols-2">
              {o.weekly.data.festivals.map((f) => (
                <div key={f.name} className="flex items-start gap-2.5 rounded-lg border p-3">
                  <CalendarHeart className="mt-0.5 size-4 shrink-0 text-gold" />
                  <div className="text-sm">
                    <p className="font-medium">
                      {f.name} <span className="text-xs font-normal text-muted-foreground">({f.window})</span>
                    </p>
                    <p className="text-muted-foreground">{f.angle}</p>
                  </div>
                </div>
              ))}
              {o.weekly.data.seasonal.map((s) => (
                <div key={s} className="flex items-start gap-2.5 rounded-lg border p-3 text-sm">
                  <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" />
                  <p className="text-muted-foreground">{s}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {/* Heatmap + engagement comparison */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <SectionCard title="Trend heatmap" subtitle="topic mentions per week">
          <TrendHeatmap topics={o.heatmap.topics} weeks={o.heatmap.weeks} cells={o.heatmap.cells} />
        </SectionCard>

        <SectionCard title="Engagement comparison" subtitle="avg likes + comments per observed post">
          <EngagementBars
            rows={[
              ...(o.ourAvgEngagement != null
                ? [{ name: "Nutriyet (you)", value: o.ourAvgEngagement, self: true }]
                : []),
              ...activeCompetitors
                .filter((c) => c.avgEngagement != null)
                .map((c) => ({ name: c.name, value: c.avgEngagement as number, self: false })),
            ]}
          />
        </SectionCard>
      </div>

      {/* Content gaps */}
      <div className="mt-4">
        <SectionCard
          title="Content gap report"
          subtitle={o.gaps ? `refreshed ${new Date(o.gaps.generatedAt).toLocaleDateString("en-IN")}` : undefined}
        >
          {o.gaps ? (
            <div className="space-y-4">
              <div className="grid gap-2.5 lg:grid-cols-2">
                {o.gaps.data.gaps.map((g) => (
                  <div key={g.gap} className="rounded-lg border p-3">
                    <div className="flex items-center gap-2">
                      <Target className="size-4 shrink-0 text-primary" />
                      <span className="text-sm font-medium">{g.gap}</span>
                      <Badge
                        variant={g.priority === "HIGH" ? "default" : g.priority === "MEDIUM" ? "secondary" : "outline"}
                        className="ml-auto text-[10px]"
                      >
                        {PRIORITY_LABEL[g.priority]}
                      </Badge>
                    </div>
                    <p className="mt-1.5 text-xs text-muted-foreground">{g.evidence}</p>
                    <p className="mt-1 text-sm">
                      <span className="text-xs font-medium text-muted-foreground">Opportunity: </span>
                      {g.opportunity}
                    </p>
                  </div>
                ))}
              </div>
              {o.gaps.data.recommendedCampaigns.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground">Recommended next campaigns</p>
                  <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
                    {o.gaps.data.recommendedCampaigns.map((c) => (
                      <div key={c.name} className="rounded-lg bg-muted/50 p-3 text-sm">
                        <p className="font-medium">
                          {c.name} <span className="text-xs font-normal text-muted-foreground">· {c.theme}</span>
                        </p>
                        <p className="mt-0.5 text-xs text-muted-foreground">{c.why}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No gap analysis yet — run the analysis to generate one.</p>
          )}
        </SectionCard>
      </div>

      {/* Top themes */}
      {o.weekly?.data.topThemes.length ? (
        <div className="mt-4">
          <SectionCard title="Top performing themes across the market">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {o.weekly.data.topThemes.map((t) => (
                <div key={t.theme} className="rounded-lg border p-3 text-sm">
                  <p className="font-medium">{t.theme}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t.note}</p>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      ) : null}

      {/* Ideas preview */}
      <div className="mt-4">
        <SectionCard
          title="Today's top content opportunities"
          subtitle={o.ideaBatchDate ? `batch of ${o.ideaBatchDate}` : undefined}
        >
          {o.todaysIdeas.length ? (
            <div className="space-y-2">
              {o.todaysIdeas.slice(0, 6).map((i) => (
                <div key={i.id} className="flex items-center gap-3 rounded-lg border px-3 py-2 text-sm">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary/10 text-xs font-bold text-primary">
                    {i.totalScore}
                  </span>
                  <span className="min-w-0 flex-1 truncate">{i.topic}</span>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {i.format}
                  </Badge>
                </div>
              ))}
              <Link
                href="/admin/social/intelligence/ideas"
                className="inline-block text-sm font-medium text-primary hover:underline"
              >
                See all {o.todaysIdeas.length} ideas →
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No ideas yet — hit &ldquo;Generate ideas&rdquo; for today&apos;s batch of original
              content opportunities.
            </p>
          )}
        </SectionCard>
      </div>

      {/* Competitor overview */}
      <div className="mt-4">
        <SectionCard title="Competitor overview">
          {o.competitors.length ? (
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {o.competitors.map((c) => (
                <Link
                  key={c.id}
                  href="/admin/social/intelligence/competitors"
                  className="hover-lift rounded-lg border p-3 transition-shadow hover:shadow-elev-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{c.name}</span>
                    {!c.active && (
                      <Badge variant="outline" className="ml-auto shrink-0 text-[10px]">
                        Paused
                      </Badge>
                    )}
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    {c.category} · {PRIORITY_LABEL[c.priority]} priority · {c.signalCount} signals
                  </p>
                  {c.profileSummary && (
                    <p className="mt-1.5 line-clamp-2 text-xs text-muted-foreground">{c.profileSummary}</p>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No competitors yet — open the manager to add the default watchlist.
            </p>
          )}
        </SectionCard>
      </div>
    </div>
  );
}

/** Single-series horizontal magnitude bars; identity is carried by the row
 *  label (our own row additionally marked), values printed at the end. */
function EngagementBars({ rows }: { rows: { name: string; value: number; self: boolean }[] }) {
  if (!rows.length) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No engagement data yet — record competitor signals with likes/comments, or publish posts to
        compare your own numbers.
      </p>
    );
  }
  const max = Math.max(...rows.map((r) => r.value), 1);
  return (
    <div className="space-y-2">
      {rows
        .sort((a, b) => b.value - a.value)
        .map((r) => (
          <div key={r.name} className="flex items-center gap-2 text-sm">
            <span className="w-36 shrink-0 truncate text-xs">
              {r.name}
            </span>
            <div className="h-4 flex-1 overflow-hidden rounded-sm bg-muted/40">
              <div
                className={r.self ? "h-full rounded-sm bg-gold" : "h-full rounded-sm bg-primary/70"}
                style={{ width: `${Math.max(2, Math.round((r.value / max) * 100))}%` }}
              />
            </div>
            <span className="w-12 shrink-0 text-right text-xs font-medium">{r.value}</span>
          </div>
        ))}
      <p className="pt-1 text-[11px] text-muted-foreground">
        Competitor numbers come from recorded public observations; yours from Instagram insights.
      </p>
    </div>
  );
}
