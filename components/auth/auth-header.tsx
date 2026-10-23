import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Shared presentational pieces + class tokens for the auth pages. A plain
 * module on purpose: server pages can render these AND read the class strings
 * (a constant exported from a "use client" file reaches RSC as a reference).
 */

/** Page heading block: optional back control, title, supporting line. */
export function AuthHeader({
  title,
  description,
  back,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  back?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-8", className)}>
      {back && <div className="mb-6">{back}</div>}
      <h1 className="font-heading text-[1.875rem] leading-[1.15] font-medium tracking-tight sm:text-[2.125rem]">
        {title}
      </h1>
      {description && (
        <p className="mt-2.5 text-[15px] leading-relaxed text-muted-foreground">{description}</p>
      )}
    </div>
  );
}

/** Hairline "or" separator between sign-in methods. */
export function AuthDivider({ label = "or" }: { label?: string }) {
  return (
    <div className="flex items-center gap-4" role="separator" aria-label={label}>
      <span className="h-px flex-1 bg-border" />
      <span className="text-[11px] font-medium tracking-[0.14em] text-muted-foreground uppercase">
        {label}
      </span>
      <span className="h-px flex-1 bg-border" />
    </div>
  );
}

/** 48px field: warm hairline, card ground, calm forest focus ring. */
export const authFieldClass =
  "h-12 rounded-lg border-input bg-card px-3.5 text-[15px] md:text-[15px] placeholder:text-muted-foreground/65 hover:border-foreground/25 focus-visible:border-primary focus-visible:ring-3 focus-visible:ring-primary/15 aria-invalid:border-destructive aria-invalid:ring-destructive/15 dark:bg-card";

/** Primary auth CTA: forest solid, 48px, spinner + progress label while pending. */
export const authPrimaryClass =
  "h-12 w-full gap-2 rounded-lg text-[15px] font-semibold tracking-[0.005em] disabled:opacity-60";

/** Outline alternative-method button (email / Google), same footprint as primary. */
export const authSecondaryClass =
  "h-12 w-full gap-2.5 rounded-lg border-input bg-card text-[15px] font-medium shadow-none hover:border-foreground/25 hover:bg-oat/50 [&_svg]:size-[18px]";

/** Quiet text link styled for the auth pages (underline on hover/focus). */
export const authLinkClass =
  "rounded-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

/** "Don't have an account? Create one" style footer line. */
export function AuthSwitch({
  prompt,
  href,
  label,
}: {
  prompt: string;
  href: string;
  label: string;
}) {
  return (
    <p className="mt-8 border-t pt-6 text-center text-sm text-muted-foreground">
      {prompt}{" "}
      <Link href={href} className={authLinkClass}>
        {label}
      </Link>
    </p>
  );
}

/** Terms / privacy consent line — both routes exist on the storefront. */
export function AuthLegal({ action = "continuing" }: { action?: string }) {
  return (
    <p className="text-center text-xs leading-relaxed text-muted-foreground">
      By {action} you agree to our{" "}
      <Link href="/terms" className="underline underline-offset-2 transition-colors hover:text-foreground">
        Terms
      </Link>{" "}
      and{" "}
      <Link href="/privacy" className="underline underline-offset-2 transition-colors hover:text-foreground">
        Privacy Policy
      </Link>
      .
    </p>
  );
}
