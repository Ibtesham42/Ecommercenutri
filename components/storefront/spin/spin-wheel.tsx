"use client";

import { Leaf } from "lucide-react";
import { cldUrl } from "@/lib/cld";
import { cn } from "@/lib/utils";

/** Segment palette (`.spin-stage` tokens in globals.css), ordered light/dark
 *  so neighbouring segments always separate. Each has its own text colour. */
const SEGMENTS = [1, 2, 3, 4, 5, 6].map((i) => ({
  fill: `var(--spin-s${i})`,
  text: `var(--spin-s${i}-fg)`,
}));

/** With an odd count the last segment would touch the first in the same
 *  tone family; skip ahead one so the seam still alternates. */
function segmentStyle(i: number, n: number) {
  const k = n % 2 === 1 && n > 1 && i === n - 1 ? (i + 1) % SEGMENTS.length : i % SEGMENTS.length;
  return SEGMENTS[k];
}

/**
 * Presentational wheel: N equal segments, pointer at 12 o'clock. Rotation is
 * driven by the parent (it already knows the server-decided result); this
 * component never chooses anything. Decorative — the result is announced in
 * text by the parent's live region, so it's aria-hidden.
 *
 * `highlightIndex` marks the winning segment once the wheel has stopped: the
 * other segments dim, so the result reads at a glance without extra effects.
 * Must sit on a `.spin-stage` ancestor (its colours come from there).
 */
export function SpinWheel({
  percents,
  rotation,
  durationMs,
  highlightIndex = null,
  logoUrl = null,
  showLabels = true,
  className,
}: {
  percents: number[];
  rotation: number;
  durationMs: number;
  highlightIndex?: number | null;
  /** Uploaded brand logo for the hub; the leaf mark stands in without one. */
  logoUrl?: string | null;
  /** Off for the decorative "resting" wheel shown while no campaign runs. */
  showLabels?: boolean;
  /** Sizing lives with the parent layout (the wheel is a square of its width). */
  className?: string;
}) {
  const n = Math.max(percents.length, 1);
  const seg = 360 / n;
  const c = 100; // centre
  const R = 86; // segment radius; the gold rim fills 86 → 100
  const big = n > 6 ? 15 : n > 4 ? 18 : 22;
  // Rim studs: a multiple of the segment count so one always marks each seam.
  const studs = n * (n <= 5 ? 4 : n <= 8 ? 3 : 2);

  const point = (deg: number, radius: number) => {
    const rad = ((deg - 90) * Math.PI) / 180;
    return [c + radius * Math.cos(rad), c + radius * Math.sin(rad)] as const;
  };

  return (
    <div data-spin-wheel className={cn("relative mx-auto aspect-square", className)} aria-hidden>
      {/* Pointer — static, overlapping the rim at 12 o'clock. */}
      <svg
        viewBox="0 0 28 32"
        className="absolute top-0 left-1/2 z-10 w-[10.5%] -translate-x-1/2 -translate-y-[30%] drop-shadow-[0_3px_3px_rgb(0_0_0/0.28)]"
      >
        <path
          d="M14 30.5 L3.2 10 A11.6 11.6 0 1 1 24.8 10 Z"
          fill="var(--spin-fg)"
          stroke="var(--spin-gold-deep)"
          strokeWidth={1.6}
          strokeLinejoin="round"
        />
        <circle cx={14} cy={11.6} r={4.4} fill="var(--spin-ink)" />
        <circle cx={14} cy={11.6} r={1.7} fill="var(--spin-gold)" />
      </svg>

      {/* overflow-hidden: the rotated square SVG's bounding box grows with the
          angle (up to √2×) — clip it to the circle or it causes page overflow. */}
      <div className="size-full overflow-hidden rounded-full shadow-(--spin-wheel-shadow)">
        <svg
          viewBox="0 0 200 200"
          className="size-full motion-reduce:!transition-none"
          style={{
            transform: `rotate(${rotation}deg)`,
            transition: durationMs > 0 ? `transform ${durationMs}ms cubic-bezier(0.17, 0.67, 0.12, 0.99)` : "none",
          }}
        >
          {/* Gold rim: darker outer edge, face, thin ink line against the segments. */}
          <circle cx={c} cy={c} r={100} fill="var(--spin-gold-deep)" />
          <circle cx={c} cy={c} r={98.2} fill="var(--spin-gold)" />
          <circle cx={c} cy={c} r={R + 1.4} fill="var(--spin-ink)" />

          {percents.map((p, i) => {
            const start = i * seg;
            const end = start + seg;
            const [x1, y1] = point(start, R);
            const [x2, y2] = point(end, R);
            const large = seg > 180 ? 1 : 0;
            const mid = start + seg / 2;
            const [tx, ty] = point(mid, R * 0.64);
            const tone = segmentStyle(i, n);
            const dimmed = highlightIndex !== null && highlightIndex !== i;
            const d =
              n === 1
                ? `M ${c} ${c - R} A ${R} ${R} 0 1 1 ${c - 0.01} ${c - R} Z`
                : `M ${c} ${c} L ${x1} ${y1} A ${R} ${R} 0 ${large} 1 ${x2} ${y2} Z`;
            return (
              <g key={p}>
                <path d={d} fill={tone.fill} />
                {showLabels && (
                  <g transform={`rotate(${mid} ${tx} ${ty})`}>
                    <text
                      x={tx}
                      y={ty - 2.5}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={tone.text}
                      className="font-heading"
                      style={{
                        fontSize: big,
                        fontWeight: 600,
                        letterSpacing: "-0.01em",
                      }}
                    >
                      {p}%
                    </text>
                    <text
                      x={tx}
                      y={ty + big * 0.64}
                      textAnchor="middle"
                      dominantBaseline="middle"
                      fill={tone.text}
                      opacity={0.82}
                      style={{
                        fontSize: 6.5,
                        fontWeight: 700,
                        letterSpacing: "0.2em",
                      }}
                    >
                      OFF
                    </text>
                  </g>
                )}
                {/* Settled result: the other segments recede under a light ink veil. */}
                <path
                  d={d}
                  fill="var(--spin-ink)"
                  className="transition-opacity duration-500 motion-reduce:transition-none"
                  opacity={dimmed ? 0.4 : 0}
                />
              </g>
            );
          })}

          {/* Seams, then a soft inner edge for depth. */}
          {n > 1 &&
            percents.map((p, i) => {
              const [x, y] = point(i * seg, R);
              return (
                <line
                  key={`seam-${p}`}
                  x1={c}
                  y1={c}
                  x2={x}
                  y2={y}
                  stroke="var(--spin-ink)"
                  strokeOpacity={0.35}
                  strokeWidth={0.8}
                />
              );
            })}
          <circle
            cx={c}
            cy={c}
            r={R - 1.2}
            fill="none"
            stroke="var(--spin-ink)"
            strokeOpacity={0.16}
            strokeWidth={2.4}
          />

          {/* ...and the winning segment is traced in ivory. */}
          {n > 1 &&
            percents.map((p, i) => {
              const [x1, y1] = point(i * seg, R - 1.6);
              const [x2, y2] = point((i + 1) * seg, R - 1.6);
              return (
                <path
                  key={`win-${p}`}
                  d={`M ${c} ${c} L ${x1} ${y1} A ${R - 1.6} ${R - 1.6} 0 ${seg > 180 ? 1 : 0} 1 ${x2} ${y2} Z`}
                  fill="none"
                  stroke="var(--spin-fg)"
                  strokeWidth={2.4}
                  strokeLinejoin="round"
                  className="transition-opacity duration-500 motion-reduce:transition-none"
                  opacity={highlightIndex === i ? 1 : 0}
                />
              );
            })}

          {/* Studs on the rim. */}
          {Array.from({ length: studs }, (_, i) => {
            const [sx, sy] = point((i * 360) / studs, 93);
            return (
              <circle
                key={`stud-${i}`}
                cx={sx}
                cy={sy}
                r={i % (studs / n) === 0 ? 2.3 : 1.6}
                fill="var(--spin-fg)"
                stroke="var(--spin-gold-deep)"
                strokeWidth={0.7}
              />
            );
          })}
        </svg>
      </div>

      {/* Hub — static and decorative (the spin control is the button below): the brand mark. */}
      <div className="absolute top-1/2 left-1/2 grid size-[23%] -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border-[3px] border-(--spin-gold) bg-(--spin-fg) shadow-[0_4px_10px_rgb(0_0_0/0.25)]">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={cldUrl(logoUrl, { h: 160 })} alt="" className="size-[72%] object-contain" />
        ) : (
          <Leaf className="size-[46%] text-(--spin-ink)" strokeWidth={1.75} />
        )}
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
