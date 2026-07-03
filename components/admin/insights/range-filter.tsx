import Link from "next/link";
import { Download, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { RangeAnalytics } from "@/lib/queries/analytics";

const PRESETS: { value: string; label: string }[] = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "30d", label: "Last 30 days" },
];

/**
 * Date-range selector for the analytics sections (URL-driven, no client JS —
 * same pattern as the returns filters) + CSV/PDF report downloads that carry
 * the active range.
 */
export function RangeFilter({ range }: { range: RangeAnalytics["range"] }) {
  const qs = new URLSearchParams({ range: range.key });
  if (range.key === "custom") {
    qs.set("from", range.fromISO.slice(0, 10));
    // toISO is exclusive; show/export the inclusive end date.
    qs.set("to", new Date(new Date(range.toISO).getTime() - 1).toISOString().slice(0, 10));
  }
  const exportQs = qs.toString();

  return (
    <div className="mb-6 flex flex-wrap items-center gap-2">
      {PRESETS.map((p) => (
        <Link
          key={p.value}
          href={`/admin/insights?range=${p.value}`}
          className={cn(
            "rounded-full border px-3 py-1 text-sm transition hover:bg-accent",
            range.key === p.value && "border-primary bg-primary/10 text-primary",
          )}
        >
          {p.label}
        </Link>
      ))}
      <form action="/admin/insights" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="range" value="custom" />
        <Input
          type="date"
          name="from"
          defaultValue={range.key === "custom" ? range.fromISO.slice(0, 10) : ""}
          className="h-8 w-36"
          aria-label="From date"
        />
        <Input
          type="date"
          name="to"
          defaultValue={
            range.key === "custom"
              ? new Date(new Date(range.toISO).getTime() - 1).toISOString().slice(0, 10)
              : ""
          }
          className="h-8 w-36"
          aria-label="To date"
        />
        <Button type="submit" variant="outline" size="sm">
          Apply
        </Button>
      </form>
      <div className="ml-auto flex gap-2">
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <a href={`/admin/insights/export?${exportQs}`}>
            <Download className="size-4" /> CSV / Excel
          </a>
        </Button>
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <a href={`/admin/insights/report?${exportQs}`} target="_blank" rel="noreferrer">
            <FileText className="size-4" /> PDF report
          </a>
        </Button>
      </div>
    </div>
  );
}
