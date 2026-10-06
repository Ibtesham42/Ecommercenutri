import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Consistent empty state used across the storefront (empty cart, wishlist, no
 * search results, no products). A bare icon and the same gold hairline accent
 * used under every page heading carry the moment — no decorative wash, no
 * icon-tile container.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: { label: string; href: string };
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-3xl border bg-card px-6 py-16 text-center shadow-elev-1",
        className,
      )}
    >
      <Icon className="size-9 text-muted-foreground/70" strokeWidth={1.5} />
      <span className="mt-4 block h-0.5 w-9 rounded-full bg-gold" />
      <h2 className="mt-4 font-heading text-lg font-semibold tracking-tight">{title}</h2>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">{description}</p>
      )}
      {action && (
        <Button asChild className="mt-6 h-11 rounded-xl px-6 font-semibold shadow-elev-1 max-sm:w-full max-sm:max-w-xs">
          <Link href={action.href}>{action.label}</Link>
        </Button>
      )}
    </div>
  );
}
