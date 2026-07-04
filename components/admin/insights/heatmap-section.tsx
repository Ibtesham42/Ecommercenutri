import { Flame, Sparkles, MousePointerClick, Info } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { HeatmapAnalytics } from "@/lib/queries/engagement";
import type { AiText } from "@/lib/ai/insights";

const nf = new Intl.NumberFormat("en-IN");

function fmtDur(ms: number): string {
  if (ms < 1000) return "<1s";
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`;
}

function scoreTier(score: number): { label: string; cls: string } {
  if (score >= 65) return { label: "High", cls: "text-primary" };
  if (score >= 35) return { label: "Medium", cls: "text-amber-600 dark:text-amber-400" };
  return { label: "Low", cls: "text-destructive" };
}

/**
 * Website Heatmap Analytics — engagement score tiles (color intensity = score),
 * a full per-section metric table and per-page scroll-depth reach, plus the AI
 * best/worst-sections read. Data is pre-aggregated daily (HeatStat), so this
 * renders instantly. Empty-state friendly for the first days of tracking.
 */
export function HeatmapSection({
  heat,
  insights,
}: {
  heat: HeatmapAnalytics;
  insights: AiText;
}) {
  const withData = heat.sections.filter((s) => s.views > 0);
  const lowConfidence = !heat.confidence.ok;

  return (
    <section className="rounded-2xl border bg-background p-5" id="heatmap">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Flame className="size-4 text-primary" /> Website heatmap analytics
        <span className="text-xs font-normal text-muted-foreground">· {heat.rangeLabel}</span>
        {lowConfidence && heat.hasData && (
          <Badge variant="secondary" className="text-[10px]">Low confidence</Badge>
        )}
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Engagement score (0–100) per tracked section — clicks, hovers, taps and time in view,
        relative to your best section. Color intensity = engagement. Sections are scored only after
        they gather enough views to be reliable.
      </p>

      {lowConfidence && heat.hasData && (
        <div className="mb-4 flex items-start gap-2 rounded-xl border border-amber-300/50 bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
          <Info className="mt-0.5 size-4 shrink-0" />
          <p>
            Only {heat.totalImpressions} section view{heat.totalImpressions === 1 ? "" : "s"} collected
            so far ({heat.confidence.min}+ needed) — treat rankings below as early signal, not
            conclusions.
          </p>
        </div>
      )}

      {/* AI read */}
      <div className="mb-5 rounded-xl border bg-gradient-to-br from-primary/10 to-transparent p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-3.5 text-primary" /> Section insights
          <Badge variant={insights.ai ? "default" : "secondary"} className="text-[10px]">
            {insights.ai ? "AI" : "Auto"}
          </Badge>
        </div>
        <p className="text-sm leading-relaxed">{insights.text}</p>
      </div>

      {!heat.hasData ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Engagement tracking just went live — the heatmap fills in as shoppers browse the store.
        </p>
      ) : (
        <>
          {/* Engagement tiles (color = score; low-sample sections stay neutral
              and read "Collecting data" rather than showing a noisy score). */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {heat.sections.map((s) => {
              const score = s.score;
              const tier = score !== null ? scoreTier(score) : null;
              return (
                <div
                  key={s.key}
                  className="rounded-xl border p-3"
                  style={
                    score !== null
                      ? {
                          backgroundColor: `color-mix(in oklab, var(--primary) ${Math.round(
                            6 + (score / 100) * 38,
                          )}%, transparent)`,
                        }
                      : undefined
                  }
                >
                  <p className="truncate text-xs font-medium">{s.label}</p>
                  {score !== null && tier ? (
                    <>
                      <p className="mt-1 text-xl font-bold tabular-nums">{score}</p>
                      <p className={`text-[10px] font-semibold ${tier.cls}`}>{tier.label} engagement</p>
                      <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                        {nf.format(s.clicks)} clicks · {s.clickRate.toFixed(1)}% CTR
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mt-1 text-sm font-semibold text-muted-foreground">Collecting data</p>
                      <p className="mt-0.5 text-[10px] tabular-nums text-muted-foreground">
                        {nf.format(s.views)} view{s.views === 1 ? "" : "s"} so far
                      </p>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          {/* Full metric table */}
          {withData.length > 0 && (
            <div className="mt-5 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Section</th>
                    <th className="py-2 pr-3 text-right font-medium">Impressions</th>
                    <th className="py-2 pr-3 text-right font-medium">Clicks</th>
                    <th className="py-2 pr-3 text-right font-medium">Click rate</th>
                    <th className="py-2 pr-3 text-right font-medium">Hovers (desktop)</th>
                    <th className="py-2 pr-3 text-right font-medium">Taps (mobile)</th>
                    <th className="py-2 pr-3 text-right font-medium">Avg time in view</th>
                    <th className="py-2 text-right font-medium">Score</th>
                  </tr>
                </thead>
                <tbody>
                  {withData.map((s) => (
                    <tr key={s.key} className="border-b last:border-0">
                      <td className="py-2 pr-3">{s.label}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{nf.format(s.views)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{nf.format(s.clicks)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{s.clickRate.toFixed(1)}%</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{nf.format(s.hovers)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{nf.format(s.taps)}</td>
                      <td className="py-2 pr-3 text-right tabular-nums">{fmtDur(s.avgTimeMs)}</td>
                      <td className="py-2 text-right font-semibold tabular-nums">
                        {s.score !== null ? s.score : <span className="font-normal text-muted-foreground">—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Scroll depth + time per page group */}
          {heat.pages.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <MousePointerClick className="size-4 text-primary" /> Scroll depth & time on page
              </h3>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {heat.pages.slice(0, 6).map((p) => (
                  <div key={p.page} className="rounded-xl border p-3">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-xs font-medium">{p.label}</p>
                      <p className="text-[10px] tabular-nums text-muted-foreground">
                        {nf.format(p.visits)} visits · avg {fmtDur(p.avgTimeMs)}
                      </p>
                    </div>
                    <div className="mt-2 space-y-1">
                      {[
                        { d: "25%", v: p.scroll25 },
                        { d: "50%", v: p.scroll50 },
                        { d: "75%", v: p.scroll75 },
                        { d: "100%", v: p.scroll100 },
                      ].map((row) => (
                        <div key={row.d} className="flex items-center gap-2 text-[10px] tabular-nums">
                          <span className="w-8 text-muted-foreground">{row.d}</span>
                          <div className="h-1.5 flex-1 rounded-full bg-muted/40">
                            <div
                              className="h-full rounded-full bg-primary/60"
                              style={{ width: `${Math.min(100, Math.max(1, row.v))}%` }}
                            />
                          </div>
                          <span className="w-9 text-right text-muted-foreground">{row.v.toFixed(0)}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}
