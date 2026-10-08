import { formatPrice } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Bottom action bar for cart and checkout below lg (both pages hide the mobile
 * tab bar). The owner decides when it shows — whenever its inline CTA is off
 * screen — so there is never a second, duplicate button in view.
 */
export function StickyTotalBar({
  show,
  total,
  note,
  children,
}: {
  show: boolean;
  total: number;
  note?: string;
  /** The action — a single full-height button. */
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background px-4 pt-3 transition-transform duration-300 motion-reduce:transition-none lg:hidden",
        show ? "translate-y-0" : "pointer-events-none translate-y-full",
      )}
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      data-sticky-bar={show ? "shown" : "hidden"}
      aria-hidden={!show}
      inert={!show}
    >
      <div className="mx-auto flex max-w-3xl items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted-foreground">Total</p>
          <p className="text-[17px] font-semibold leading-tight tabular-nums">{formatPrice(total)}</p>
          {note && <p className="truncate text-xs text-muted-foreground">{note}</p>}
        </div>
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
