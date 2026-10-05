import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Shared editorial section header (gold tick + serif heading + optional ghost
 *  CTA) — every homepage content section uses this so the page reads as one
 *  consistent typographic rhythm rather than each section inventing its own
 *  heading treatment. */
export function SectionHeading({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
}: {
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div className="min-w-0">
        <span className="mb-3 block h-0.5 w-9 rounded-full bg-gold" />
        <h2 className="font-heading text-[1.75rem] leading-[1.1] font-semibold tracking-tight sm:text-4xl">
          {title}
        </h2>
        {subtitle && <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>}
      </div>
      {ctaHref && ctaLabel && (
        <Button asChild variant="ghost" className="shrink-0 gap-1 text-primary hover:text-primary">
          <Link href={ctaHref}>
            {ctaLabel} <ArrowRight className="size-4" />
          </Link>
        </Button>
      )}
    </div>
  );
}
