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
 * Error/success message for the auth forms (also used by the quiz sign-up).
 * Announced to screen readers: errors assertively, successes politely.
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
      role={kind === "error" ? "alert" : "status"}
      className={cn(
        "flex animate-fade-up items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm leading-snug",
        kind === "error"
          ? "border-destructive/20 bg-destructive/[0.06] text-destructive"
          : "border-primary/15 bg-sage text-sage-foreground",
      )}
    >
      <Icon aria-hidden className="mt-px size-4 shrink-0" />
      <span>{children}</span>
    </p>
  );
}
