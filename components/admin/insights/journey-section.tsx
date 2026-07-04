import { Route, Sparkles, Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { JourneyAnalytics } from "@/lib/queries/journey";
import type { AiText } from "@/lib/ai/insights";

const nf = new Intl.NumberFormat("en-IN");

function fmtDur(ms: number): string {
  if (ms < 1000) return "<1s";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m ${s % 60}s` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/**
 * Customer Journey Analytics — the full 11-stage funnel with per-stage
 * conversion/drop-off/exit/avg-time and previous-period deltas, plus
 * device/source/product/state/city filters (URL-driven form, zero client JS)
 * and an AI drop-off diagnosis. Fully additive to the existing sections.
 */
export function JourneySection({
  journey,
  diagnosis,
}: {
  journey: JourneyAnalytics;
  diagnosis: AiText;
}) {
  const j = journey;
  const maxUsers = Math.max(1, ...j.stages.map((s) => s.users));
  const rangeQs: Record<string, string> = { range: j.range.key };
  if (j.range.key === "custom") {
    rangeQs.from = j.range.fromISO.slice(0, 10);
    rangeQs.to = new Date(new Date(j.range.toISO).getTime() - 1).toISOString().slice(0, 10);
  }

  const selects: {
    name: string;
    label: string;
    value: string | undefined;
    options: { value: string; label: string }[];
  }[] = [
    {
      name: "device",
      label: "Device",
      value: j.applied.device,
      options: ["mobile", "tablet", "desktop"].map((d) => ({ value: d, label: d[0].toUpperCase() + d.slice(1) })),
    },
    {
      name: "source",
      label: "Traffic source",
      value: j.applied.source,
      options: j.options.sources.map((s) => ({ value: s, label: s })),
    },
    {
      name: "product",
      label: "Product",
      value: j.applied.product,
      options: j.options.products.map((p) => ({ value: p.id, label: p.name })),
    },
    {
      name: "state",
      label: "State",
      value: j.applied.state,
      options: j.options.states.map((s) => ({ value: s, label: s })),
    },
    {
      name: "city",
      label: "City",
      value: j.applied.city,
      options: j.options.cities.map((c) => ({ value: c, label: c })),
    },
  ];

  return (
    <section className="rounded-2xl border bg-background p-5" id="journey">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Route className="size-4 text-primary" /> Customer journey analytics
        <span className="text-xs font-normal text-muted-foreground">· {j.range.label}</span>
        {!j.confidence.ok && j.totalSessions > 0 && (
          <Badge variant="secondary" className="text-[10px]">Low confidence</Badge>
        )}
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        {nf.format(j.totalSessions)} shopper session{j.totalSessions === 1 ? "" : "s"}
        {j.filtered ? " (filtered)" : ""} — each stage counts unique shoppers reaching it.
        {!j.confidence.ok && j.totalSessions > 0
          ? ` Need ${j.confidence.min}+ for reliable conversion rates.`
          : ""}
      </p>

      {/* Filters — plain GET form, same URL-driven pattern as the range filter. */}
      <form action="/admin/insights" className="mb-5 flex flex-wrap items-end gap-2">
        {Object.entries(rangeQs).map(([k, v]) => (
          <input key={k} type="hidden" name={k} value={v} />
        ))}
        {selects.map((sel) => (
          <label key={sel.name} className="flex flex-col gap-1 text-[11px] font-medium text-muted-foreground">
            {sel.label}
            <select
              name={sel.name}
              defaultValue={sel.value ?? ""}
              className="h-8 max-w-40 rounded-lg border bg-background px-2 text-xs text-foreground"
            >
              <option value="">All</option>
              {sel.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label.length > 28 ? `${o.label.slice(0, 28)}…` : o.label}
                </option>
              ))}
            </select>
          </label>
        ))}
        <Button type="submit" variant="outline" size="sm" className="gap-1.5">
          <Filter className="size-3.5" /> Apply
        </Button>
        {j.filtered && (
          <Button asChild variant="ghost" size="sm">
            <a href={`/admin/insights?${new URLSearchParams(rangeQs).toString()}`}>Clear</a>
          </Button>
        )}
      </form>

      {/* AI drop-off diagnosis */}
      <div className="mb-5 rounded-xl border bg-gradient-to-br from-primary/10 to-transparent p-4">
        <div className="mb-1 flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="size-3.5 text-primary" /> Where shoppers drop off
          <Badge variant={diagnosis.ai ? "default" : "secondary"} className="text-[10px]">
            {diagnosis.ai ? "AI" : "Auto"}
          </Badge>
        </div>
        <p className="text-sm leading-relaxed">{diagnosis.text}</p>
      </div>

      {/* Stages */}
      <div className="space-y-3">
        {j.stages.map((s) => (
          <div key={s.key} className="group">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
              <p className="text-sm font-medium">
                {s.label}
                {s.optional && (
                  <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">(optional path)</span>
                )}
              </p>
              <span className="text-sm font-semibold tabular-nums">{nf.format(s.users)}</span>
            </div>
            <div className="mt-1 h-3.5 w-full rounded-md bg-muted/40">
              <div
                className={cn(
                  "h-full rounded-md transition-colors duration-150",
                  s.pending ? "bg-muted" : "bg-primary/60 group-hover:bg-primary",
                )}
                style={{ width: `${Math.min(100, Math.max(3, (s.users / maxUsers) * 100))}%` }}
              />
            </div>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] tabular-nums text-muted-foreground">
              {s.pending ? (
                <span>Tracking just enabled — fills in as shoppers reach this step.</span>
              ) : (
                <>
                  {s.convPct !== null && <span>{s.convPct.toFixed(0)}% conversion</span>}
                  {s.dropPct !== null && s.dropPct > 0 && (
                    <span className="text-destructive/80">{s.dropPct.toFixed(0)}% drop-off</span>
                  )}
                  {s.exitPct !== null && <span>{s.exitPct.toFixed(0)}% exit here</span>}
                  {s.avgTimeMs !== null && <span>avg {fmtDur(s.avgTimeMs)} to next step</span>}
                  {s.deltaPct !== null && (
                    <span className={s.deltaPct >= 0 ? "text-primary" : "text-destructive"}>
                      {s.deltaPct >= 0 ? "↑" : "↓"} {Math.abs(s.deltaPct).toFixed(0)}% vs prev period
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
