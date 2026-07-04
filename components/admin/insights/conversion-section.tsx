import { Rocket, TrendingUp, TrendingDown } from "lucide-react";
import type { ConversionAnalytics } from "@/lib/queries/conversion";

const nf = new Intl.NumberFormat("en-IN");

function Delta({ pct, invert }: { pct: number | null; invert?: boolean }) {
  if (pct === null) return null;
  const good = invert ? pct <= 0 : pct >= 0;
  const Icon = pct >= 0 ? TrendingUp : TrendingDown;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[11px] font-medium ${good ? "text-primary" : "text-destructive"}`}>
      <Icon className="size-3" />
      {pct >= 0 ? "+" : ""}
      {pct.toFixed(0)}%
    </span>
  );
}

/**
 * Conversion-optimization (growth) funnel on /admin/insights — quiz starts →
 * completes → signups, plus welcome-popup and sticky-bar performance. Additive
 * section; renders an empty state until the growth features gather activity.
 */
export function ConversionSection({ data }: { data: ConversionAnalytics }) {
  const { quiz } = data;
  const funnel = [
    { label: "Started", value: quiz.starts },
    { label: "Completed", value: quiz.completes },
    { label: "Signed up", value: quiz.signups },
  ];
  const max = Math.max(1, quiz.starts, quiz.completes, quiz.signups);

  return (
    <section className="rounded-2xl border bg-background p-5" id="conversion">
      <h2 className="mb-1 flex items-center gap-2 font-semibold">
        <Rocket className="size-4 text-primary" /> Conversion &amp; growth
        <span className="text-xs font-normal text-muted-foreground">· {data.rangeLabel}</span>
      </h2>
      <p className="mb-4 text-xs text-muted-foreground">
        Health Score quiz funnel, welcome popup and sticky offer bar — the Phase 1 signup drivers.
      </p>

      {!data.hasData ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No growth-feature activity in this period yet — the quiz, popup and offer bar fill this in as visitors engage.
        </p>
      ) : (
        <>
          {/* Quiz funnel */}
          <div className="mb-5 rounded-xl border p-4">
            <h3 className="mb-3 text-sm font-semibold">Health Score quiz funnel</h3>
            <div className="space-y-2.5">
              {funnel.map((s, i) => (
                <div key={s.label}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="font-medium">{s.label}</span>
                    <span className="tabular-nums">
                      <span className="font-semibold">{nf.format(s.value)}</span>
                      {i > 0 && funnel[i - 1].value > 0 && (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {((s.value / funnel[i - 1].value) * 100).toFixed(0)}%
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 w-full rounded-full bg-muted/40">
                    <div className="h-full rounded-full bg-primary/60" style={{ width: `${Math.max(3, (s.value / max) * 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Metric cards */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {data.metrics.map((m) => (
              <div key={m.key} className="rounded-xl border p-3">
                <p className="text-xs text-muted-foreground">{m.label}</p>
                <p className="mt-1 text-xl font-bold tabular-nums">{nf.format(m.value)}</p>
                <div className="mt-0.5 flex items-center gap-2">
                  <Delta pct={m.deltaPct} />
                  {m.sub && <span className="text-[11px] text-muted-foreground">{m.sub}</span>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </section>
  );
}
