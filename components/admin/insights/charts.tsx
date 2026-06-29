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

/** Interactive bar chart — hover a bar for its value. Responsive, lightweight. */
export function MiniBars({
  data,
  labels,
  format,
  className,
}: {
  data: number[];
  labels?: string[];
  format?: (n: number) => string;
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
            <span className="font-medium">{format ? format(v) : v}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
