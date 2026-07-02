import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { Leaf } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Consistent, friendly empty state used across the storefront (empty cart,
 * wishlist, no search results, no products). Icon + heading + hint + optional
 * CTA, on a soft branded wash with a leaf flourish — premium, never plain.
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
        "relative flex flex-col items-center justify-center overflow-hidden rounded-3xl border bg-gradient-to-b from-accent/35 via-card to-card px-6 py-16 text-center shadow-elev-1",
        className,
      )}
    >
      {/* Decorative brand leaves — pure ornament. */}
      <Leaf
        aria-hidden
        className="pointer-events-none absolute -left-4 -top-4 size-24 rotate-[-24deg] text-primary/[0.07]"
      />
      <Leaf
        aria-hidden
        className="pointer-events-none absolute -bottom-6 -right-4 size-28 rotate-[18deg] text-gold/10"
      />
      <span className="relative grid size-16 place-items-center rounded-2xl bg-accent/60 text-primary shadow-elev-1 ring-4 ring-accent/30">
        <Icon className="size-8" />
      </span>
      <h2 className="mt-5 font-heading text-lg font-semibold tracking-tight">{title}</h2>
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
