"use client";

import { cn } from "@/lib/utils";

/** Dependency-free SVG sparkline (line + faint area). Scales to its container. */
export function Sparkline({
  data,
  height = 40,
  className,
}: {
  data: number[];
  height?: number;
  className?: string;
}) {
  if (data.length === 0) return null;
  const max = Math.max(1, ...data);
  const w = 100;
  const step = data.length > 1 ? w / (data.length - 1) : w;
  const pts = data.map((v, i) => `${(i * step).toFixed(2)},${(height - (v / max) * height).toFixed(2)}`);
  const line = pts.join(" ");
  const area = `0,${height} ${line} ${w},${height}`;
  return (
    <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className={cn("w-full text-primary", className)}
      style={{ height }}
      aria-hidden
    >
      <polygon points={area} className="fill-primary/10" />
      <polyline
        points={line}
        fill="none"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

export type FunnelStageView = {
  label: string;
  countLabel: string; // pre-formatted count, e.g. "1,248"
  widthPct: number; // bar width vs the first stage (0-100)
  convLabel?: string; // "32% of previous"
  dropLabel?: string; // "68% drop-off"
  deltaLabel?: string; // "+12% vs previous period"
  deltaUp?: boolean;
  sub?: string;
  pending?: boolean; // tracking just enabled — muted bar + note
};

/**
 * Conversion-funnel chart: one horizontal magnitude bar per stage, all in the
 * single brand hue (identity lives in the text labels, per the dataviz rules —
 * no legend needed for a single series). Every value is direct-labeled, so no
 * tooltip layer is required. Stacks cleanly at 360px.
 */
export function FunnelChart({ stages, className }: { stages: FunnelStageView[]; className?: string }) {
  if (stages.length === 0) return null;
  return (
    <div className={cn("space-y-3", className)}>
      {stages.map((s, i) => (
        <div key={i} className="group">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
            <p className="text-sm font-medium">
              {s.label}
              {s.sub ? <span className="ml-1.5 text-xs font-normal text-muted-foreground">{s.sub}</span> : null}
            </p>
            <div className="flex items-baseline gap-2 text-xs tabular-nums">
              <span className="text-sm font-semibold">{s.countLabel}</span>
              {s.convLabel ? <span className="text-muted-foreground">{s.convLabel}</span> : null}
              {s.dropLabel ? <span className="text-destructive/80">{s.dropLabel}</span> : null}
              {s.deltaLabel ? (
                <span className={s.deltaUp ? "text-primary" : "text-destructive"}>
                  {s.deltaUp ? "↑" : "↓"} {s.deltaLabel}
                </span>
              ) : null}
            </div>
          </div>
          <div className="mt-1 h-4 w-full rounded-md bg-muted/40">
            <div
              className={cn(
                "h-full rounded-md transition-colors duration-150",
                s.pending ? "bg-muted" : "bg-primary/60 group-hover:bg-primary",
              )}
              style={{ width: `${Math.min(100, Math.max(4, s.widthPct))}%` }}
            />
          </div>
          {s.pending ? (
            <p className="mt-0.5 text-[11px] text-muted-foreground">
              Tracking just enabled — data appears as shoppers reach this step.
            </p>
          ) : null}
        </div>
      ))}
    </div>
  );
}

/**
 * Labeled proportional bars (devices, traffic sources, cities, states). Single
 * brand hue for magnitude; identity is the text label; values direct-labeled.
 */
export function BreakdownBars({
  items,
  className,
}: {
  items: { label: string; pct: number; valueLabel: string }[];
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={cn("space-y-2.5", className)}>
      {items.map((it, i) => (
        <div key={i} className="group">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate">{it.label}</span>
            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{it.valueLabel}</span>
          </div>
          <div className="mt-1 h-2 w-full rounded-full bg-muted/40">
            <div
              className="h-full rounded-full bg-primary/60 transition-colors duration-150 group-hover:bg-primary"
              style={{ width: `${Math.min(100, Math.max(2, it.pct))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Interactive bar chart — hover a bar for its value. Responsive, lightweight.
 * `valueLabels` are pre-formatted tooltip strings (passed from the server so no
 * function crosses the client boundary). Falls back to the raw number.
 */
export function MiniBars({
  data,
  labels,
  valueLabels,
  className,
}: {
  data: number[];
  labels?: string[];
  valueLabels?: string[];
  className?: string;
}) {
  const max = Math.max(1, ...data);
  return (
    <div className={cn("flex h-28 items-end gap-px", className)}>
      {data.map((v, i) => (
        <div key={i} className="group relative flex h-full flex-1 items-end">
          <div
            className="w-full rounded-t-sm bg-primary/60 transition-colors duration-150 group-hover:bg-primary"
            style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
          />
          <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-popover px-2 py-1 text-[11px] shadow-elev-2 group-hover:block">
            {labels?.[i] ? <span className="text-muted-foreground">{labels[i]} · </span> : null}
            <span className="font-medium">{valueLabels?.[i] ?? v}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
