import { cn } from "@/lib/utils";

/**
 * Nutriyet's brand ornament: an original line fish drawn in the Madhubani
 * "kachni" (double-line) manner — the fish is a Mithila emblem and also
 * appears in the carved panel of the brand's own makhana photography.
 *
 * Usage rules (design system): at most one ornament per section, gold
 * hairline only, never behind text, never animated. Purely decorative.
 */
export function MithilaFish({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 16"
      fill="none"
      stroke="currentColor"
      strokeWidth={1}
      aria-hidden="true"
      focusable="false"
      className={cn("h-[11px] w-[26px] shrink-0 text-gold", className)}
    >
      <path d="M3 8c6-6.5 18-6.5 26 0-8 6.5-20 6.5-26 0Z" />
      <path d="M7.5 8c5-4 13-4 18 0" />
      <path d="M29 8l7-5.5-1.4 5.5 1.4 5.5z" />
      <circle cx="8.6" cy="7.2" r=".9" fill="currentColor" stroke="none" />
      <path d="M15 4.6c1.6 2 1.6 4.8 0 6.8M19.5 4.3c1.6 2.2 1.6 5.2 0 7.4" />
    </svg>
  );
}

/** Double-hairline divider with the fish at its centre (footer, drawer, story band). */
export function KachniRule({ className, align = "center" }: { className?: string; align?: "center" | "start" }) {
  return (
    <div role="presentation" className={cn("kachni", align === "start" && "kachni-start", className)}>
      <MithilaFish />
    </div>
  );
}
