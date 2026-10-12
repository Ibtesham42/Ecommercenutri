"use client";

import { cn } from "@/lib/utils";

/**
 * Presentational wheel: N equal segments, pointer at 12 o'clock. Rotation is
 * driven by the parent (it already knows the server-decided result); this
 * component never chooses anything. Decorative — the result is announced in
 * text by the parent's live region, so the SVG is aria-hidden.
 *
 * `highlightIndex` marks the winning segment once the wheel has stopped (it
 * sits under the pointer, upright), so the result reads at a glance.
 */
export function SpinWheel({
  percents,
  rotation,
  durationMs,
  highlightIndex = null,
}: {
  percents: number[];
  rotation: number;
  durationMs: number;
  highlightIndex?: number | null;
}) {
  const n = Math.max(percents.length, 1);
  const seg = 360 / n;
  const r = 100;
  const big = n > 6 ? 15 : n > 4 ? 18 : 21;

  const point = (deg: number, radius: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [r + radius * Math.cos(rad), r + radius * Math.sin(rad)] as const;
  };

  return (
    <div
      className="relative mx-auto aspect-square w-full max-w-[17.5rem] min-[400px]:max-w-[19rem] sm:max-w-[23rem] lg:max-w-none"
      aria-hidden
    >
      {/* Pointer */}
      <svg
        viewBox="0 0 24 22"
        className="absolute top-0 left-1/2 z-10 w-[9%] -translate-x-1/2 -translate-y-[30%] drop-shadow-[0_1px_1px_rgb(0_0_0/0.18)]"
      >
        <path d="M12 21 L2 3.5 Q12 0 22 3.5 Z" className="fill-primary stroke-card" strokeWidth={1.5} strokeLinejoin="round" />
      </svg>
      {/* overflow-hidden: the rotated square SVG's bounding box grows with the
          angle (up to √2×) — clip it to the circle or it causes page overflow. */}
      <div className="size-full overflow-hidden rounded-full bg-card p-[3%] shadow-elev-2 ring-1 ring-border">
        <svg
          viewBox="0 0 200 200"
          className="size-full motion-reduce:!transition-none"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: durationMs > 0 ? `transform ${durationMs}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)` : "none",
          }}
        >
          {percents.map((p, i) => {
            const start = i * seg;
            const end = start + seg;
            const [x1, y1] = point(start, r);
            const [x2, y2] = point(end, r);
            const large = seg > 180 ? 1 : 0;
            const mid = start + seg / 2;
            const [tx, ty] = point(mid, r * 0.64);
            const won = highlightIndex === i;
            const d =
              n === 1
                ? `M ${r} 0 A ${r} ${r} 0 1 1 ${r - 0.01} 0 Z`
                : `M ${r} ${r} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
            return (
              <g key={p}>
                <path
                  d={d}
                  className={cn(
                    "transition-[fill] duration-500 motion-reduce:transition-none",
                    won ? "fill-primary" : i % 2 === 0 ? "fill-oat" : "fill-card",
                  )}
                />
                <path d={`M ${r} ${r} L ${x1} ${y1}`} className="stroke-border" strokeWidth={0.75} />
                <g transform={`rotate(${mid} ${tx} ${ty})`}>
                  <text
                    x={tx}
                    y={ty - 3}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={cn("font-heading transition-[fill] duration-500", won ? "fill-primary-foreground" : "fill-foreground")}
                    style={{ fontSize: big, fontWeight: 600, letterSpacing: "-0.01em" }}
                  >
                    {p}%
                  </text>
                  <text
                    x={tx}
                    y={ty + big * 0.62}
                    textAnchor="middle"
                    dominantBaseline="middle"
                    className={cn("transition-[fill] duration-500", won ? "fill-primary-foreground/85" : "fill-muted-foreground")}
                    style={{ fontSize: 6.5, fontWeight: 600, letterSpacing: "0.18em" }}
                  >
                    OFF
                  </text>
                </g>
              </g>
            );
          })}
          <circle cx={r} cy={r} r={r - 1} fill="none" className="stroke-primary/70" strokeWidth={2} />
        </svg>
      </div>
      {/* Hub (static, doesn't rotate) */}
      <div className="absolute top-1/2 left-1/2 grid size-[19%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-card bg-primary text-[10px] font-semibold tracking-[0.16em] text-primary-foreground uppercase shadow-elev-1 sm:text-[11px]">
        Spin
      </div>
    </div>
  );
}

/** Rotation (deg) that lands segment `index` under the top pointer, after `turns` full turns. */
export function rotationFor(index: number, count: number, from: number, turns = 5, jitter = 0): number {
  const seg = 360 / Math.max(count, 1);
  const target = 360 - (index * seg + seg / 2) + jitter * seg * 0.3;
  const base = Math.ceil(from / 360) * 360;
  return base + turns * 360 + target;
}
