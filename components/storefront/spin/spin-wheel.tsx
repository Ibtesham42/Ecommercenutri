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
  className,
}: {
  percents: number[];
  rotation: number;
  durationMs: number;
  highlightIndex?: number | null;
  /** Sizing lives with the parent layout (the wheel is a square of its width). */
  className?: string;
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
    <div className={cn("relative mx-auto aspect-square", className)} aria-hidden>
      {/* Pointer — static, overlapping the rim at 12 o'clock. */}
      <svg
        viewBox="0 0 28 30"
        className="absolute top-0 left-1/2 z-10 w-[11%] -translate-x-1/2 -translate-y-[38%] drop-shadow-[0_2px_2px_rgb(0_0_0/0.2)]"
      >
        <path
          d="M14 28.5 L3 9 A11.5 11.5 0 1 1 25 9 Z"
          className="fill-primary stroke-card"
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <circle cx={14} cy={11.5} r={3.6} className="fill-card" />
      </svg>
      {/* overflow-hidden: the rotated square SVG's bounding box grows with the
          angle (up to √2×) — clip it to the circle or it causes page overflow. */}
      <div className="size-full overflow-hidden rounded-full bg-card p-[3.5%] shadow-elev-2 ring-1 ring-border">
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
            const [tx, ty] = point(mid, r * 0.62);
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
                {n > 1 && <path d={`M ${r} ${r} L ${x1} ${y1}`} className="stroke-border" strokeWidth={0.75} />}
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
          {/* Rim pegs on the segment boundaries. */}
          {n > 1 &&
            percents.map((p, i) => {
              const [px, py] = point(i * seg, r - 6);
              return <circle key={`peg-${p}`} cx={px} cy={py} r={2.4} className="fill-card stroke-primary/60" strokeWidth={1} />;
            })}
        </svg>
      </div>
      {/* Hub — static and purely decorative; the spin control is the button below the wheel. */}
      <div className="absolute top-1/2 left-1/2 grid size-[15%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-card bg-primary shadow-elev-1">
        <span className="size-[34%] rounded-full bg-card/90" />
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
