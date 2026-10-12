"use client";

import { prizeLabel } from "@/lib/spin/config";

/**
 * Presentational wheel: N equal segments, pointer at 12 o'clock. Rotation is
 * driven by the parent (it already knows the server-decided result); this
 * component never chooses anything. Decorative — the result is announced in
 * text by the parent's live region, so the SVG is aria-hidden.
 */
export function SpinWheel({
  percents,
  rotation,
  durationMs,
}: {
  percents: number[];
  rotation: number;
  durationMs: number;
}) {
  const n = Math.max(percents.length, 1);
  const seg = 360 / n;
  const r = 100;

  const point = (deg: number, radius: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [r + radius * Math.cos(rad), r + radius * Math.sin(rad)] as const;
  };

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[22rem] sm:max-w-[26rem]" aria-hidden>
      {/* Pointer */}
      <svg viewBox="0 0 24 20" className="absolute top-0 left-1/2 z-10 w-7 -translate-x-1/2 -translate-y-1 drop-shadow-sm">
        <path d="M12 20 L1 2 Q12 -1 23 2 Z" className="fill-primary" />
      </svg>
      {/* overflow-hidden: the rotated square SVG's bounding box grows with the
          angle (up to √2×) — clip it to the circle or it causes page overflow. */}
      <div className="size-full overflow-hidden rounded-full border border-border bg-card p-2 shadow-elev-2 sm:p-2.5">
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
            const d =
              n === 1
                ? `M ${r} 0 A ${r} ${r} 0 1 1 ${r - 0.01} 0 Z`
                : `M ${r} ${r} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
            return (
              <g key={p}>
                <path d={d} className={i % 2 === 0 ? "fill-oat" : "fill-card"} />
                <path d={`M ${r} ${r} L ${x1} ${y1}`} className="stroke-border" strokeWidth={0.75} />
                <text
                  x={tx}
                  y={ty}
                  transform={`rotate(${mid} ${tx} ${ty})`}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  className="fill-foreground font-heading"
                  style={{ fontSize: n > 6 ? 11 : 13, fontWeight: 600 }}
                >
                  {prizeLabel(p)}
                </text>
              </g>
            );
          })}
          <circle cx={r} cy={r} r={r - 0.5} fill="none" className="stroke-primary/40" strokeWidth={1} />
        </svg>
      </div>
      {/* Hub (static, doesn't rotate) */}
      <div className="absolute top-1/2 left-1/2 grid size-14 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-4 border-card bg-primary text-[11px] font-semibold tracking-[0.14em] text-primary-foreground uppercase shadow-elev-1 sm:size-16">
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
