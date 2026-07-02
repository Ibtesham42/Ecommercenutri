import type { LucideIcon } from "lucide-react";
import { AlertCircle, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Auth-flow input with a premium MOBILE treatment (taller, rounded, leading
 * icon, soft focus ring) that leaves the desktop (`sm:`+) rendering pixel-equal
 * to the stock `<Input>` — the icon is `sm:hidden` and every style override is
 * `max-sm:`-gated. `rightSlot` hosts the password visibility toggle.
 */
export function AuthInput({
  icon: Icon,
  rightSlot,
  className,
  ...props
}: React.ComponentProps<typeof Input> & {
  icon?: LucideIcon;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div className="relative">
      {Icon && (
        <Icon
          aria-hidden
          className="pointer-events-none absolute left-3.5 top-1/2 size-[18px] -translate-y-1/2 text-muted-foreground/70 sm:hidden"
        />
      )}
      <Input
        className={cn(
          // Mobile-only: comfortable 48px target, softer radius, calmer ring.
          "max-sm:h-12 max-sm:rounded-xl max-sm:px-4 max-sm:text-base",
          "max-sm:bg-background max-sm:focus-visible:border-primary/50 max-sm:focus-visible:ring-primary/25",
          Icon && "max-sm:pl-11",
          className,
        )}
        {...props}
      />
      {rightSlot}
    </div>
  );
}

/**
 * Error/success message for the auth forms. Desktop keeps the existing plain
 * styling; mobile gets an icon, a softer card shape and a gentle entrance.
 */
export function AuthAlert({
  kind,
  children,
}: {
  kind: "error" | "success";
  children: React.ReactNode;
}) {
  const Icon = kind === "error" ? AlertCircle : CheckCircle2;
  return (
    <p
      className={cn(
        "rounded-md px-3 py-2 text-sm",
        "max-sm:flex max-sm:animate-fade-up max-sm:items-start max-sm:gap-2 max-sm:rounded-xl max-sm:px-3.5 max-sm:py-3",
        kind === "error" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary",
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 sm:hidden" />
      <span>{children}</span>
    </p>
  );
}
