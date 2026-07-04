"use client";

import { useEffect, useState } from "react";

/**
 * Dependency-free circular score gauge (0–100). The ring animates from empty to
 * the value on mount via a CSS transition on the SVG stroke; the fill is
 * suppressed under prefers-reduced-motion (it just renders at the final value).
 */
export function ScoreGauge({
  score,
  band,
  size = 176,
}: {
  score: number;
  band: string;
  size?: number;
}) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const reduce =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setProgress(score);
      return;
    }
    const id = requestAnimationFrame(() => setProgress(score));
    return () => cancelAnimationFrame(id);
  }, [score]);

  const offset = circumference - (Math.min(100, Math.max(0, progress)) / 100) * circumference;

  return (
    <div className="relative grid place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-muted/40" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          className="text-primary transition-[stroke-dashoffset] duration-1000 ease-out"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 grid place-content-center text-center">
        <span className="font-heading text-4xl font-bold tabular-nums leading-none">{score}</span>
        <span className="mt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">/ 100</span>
        <span className="mt-1.5 text-sm font-semibold text-primary">{band}</span>
      </div>
    </div>
  );
}
