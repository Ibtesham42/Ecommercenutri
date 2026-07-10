import { cn } from "@/lib/utils";
import type { HeatmapCell } from "@/lib/queries/intelligence";

/**
 * Topic × ISO-week signal-frequency heatmap. Sequential encoding: one hue
 * (brand primary), light→dark by count, on the card surface; counts are also
 * printed in-cell so the value is never color-alone.
 */
export function TrendHeatmap({
  topics,
  weeks,
  cells,
}: {
  topics: string[];
  weeks: string[];
  cells: HeatmapCell[];
}) {
  if (!topics.length) {
    return (
      <p className="p-6 text-center text-sm text-muted-foreground">
        No topic signals yet — record competitor observations with topic tags to build the trend map.
      </p>
    );
  }
  const byKey = new Map(cells.map((c) => [`${c.topic}|${c.week}`, c.count]));
  const max = Math.max(1, ...cells.map((c) => c.count));
  const step = (count: number): string => {
    if (count === 0) return "bg-muted/40";
    const r = count / max;
    if (r <= 0.25) return "bg-primary/20";
    if (r <= 0.5) return "bg-primary/40";
    if (r <= 0.75) return "bg-primary/65";
    return "bg-primary/90";
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0.5 text-xs">
        <thead>
          <tr>
            <th className="min-w-32 p-1 text-left font-medium text-muted-foreground">Topic</th>
            {weeks.map((w) => (
              <th key={w} className="p-1 text-center font-normal text-muted-foreground">
                {w.slice(5)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {topics.map((t) => (
            <tr key={t}>
              <td className="max-w-40 truncate p-1 pr-2 font-medium capitalize">{t}</td>
              {weeks.map((w) => {
                const count = byKey.get(`${t}|${w}`) ?? 0;
                return (
                  <td key={w}>
                    <div
                      title={`${t} · ${w}: ${count} signal${count === 1 ? "" : "s"}`}
                      className={cn(
                        "flex h-7 min-w-9 items-center justify-center rounded-md",
                        step(count),
                        count / max > 0.5 ? "text-primary-foreground" : "text-foreground/70",
                      )}
                    >
                      {count > 0 ? count : ""}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Mentions per ISO week across observed competitor signals (last 8 weeks).
      </p>
    </div>
  );
}
