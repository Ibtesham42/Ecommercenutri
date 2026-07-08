import type { LucideIcon } from "lucide-react";

/**
 * Compact, handcrafted stat tile for the AI Marketing dashboards. Consistent
 * label/value hierarchy with tabular figures and an optional icon + hint — one
 * shared component so every surface reads as the same premium system.
 */
export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: number | string;
  icon?: LucideIcon;
  hint?: string;
}) {
  return (
    <div className="rounded-xl border bg-card p-3.5 shadow-elev-1 transition-colors hover:border-primary/30 sm:p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="truncate text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {Icon && <Icon className="size-4 shrink-0 text-muted-foreground/60" />}
      </div>
      <p className="mt-1.5 text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
