import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Sparkline } from "@/components/admin/insights/charts";
import { cn } from "@/lib/utils";

/**
 * KPI tile for the analytics dashboard: pre-formatted value, delta-vs-previous
 * chip and an optional sparkline. Server component (values are formatted by the
 * caller); renders the client Sparkline as a child.
 */
export function KpiCard({
  label,
  value,
  deltaPct,
  invertDelta = false,
  series,
  note,
}: {
  label: string;
  value: string;
  deltaPct: number | null;
  /** For metrics where DOWN is good (abandonment, bounce): flips the chip color. */
  invertDelta?: boolean;
  series?: number[];
  note?: string;
}) {
  const up = deltaPct !== null && deltaPct >= 0;
  const good = deltaPct === null ? true : invertDelta ? !up : up;
  return (
    <div className="rounded-xl border bg-background p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs text-muted-foreground">{label}</p>
        {deltaPct !== null && (
          <span
            className={cn(
              "inline-flex shrink-0 items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium tabular-nums",
              good ? "bg-primary/10 text-primary" : "bg-destructive/10 text-destructive",
            )}
          >
            {up ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(deltaPct) >= 1000 ? ">999" : Math.abs(deltaPct).toFixed(0)}%
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xl font-bold tracking-tight tabular-nums">{value}</p>
      {series && series.length > 1 && <Sparkline data={series} height={28} className="mt-2" />}
      {note && <p className="mt-1 text-[11px] leading-snug text-muted-foreground">{note}</p>}
    </div>
  );
}
