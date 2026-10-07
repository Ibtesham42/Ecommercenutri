import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** Shared editorial section header: optional eyebrow, serif heading, quiet
 *  supporting line, and a plain "View all →" text link aligned to the
 *  baseline — typography carries the hierarchy, not decoration. */
export function SectionHeading({
  title,
  subtitle,
  ctaLabel,
  ctaHref,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  eyebrow?: string;
}) {
  return (
    <div className="mb-8 flex items-end justify-between gap-6 md:mb-10">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow mb-3">{eyebrow}</p>}
        <h2 className="font-heading text-heading font-medium text-foreground">{title}</h2>
        {subtitle && (
          <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-muted-foreground">{subtitle}</p>
        )}
      </div>
      {ctaHref && ctaLabel && (
        <Link
          href={ctaHref}
          className="inline-flex min-h-11 shrink-0 items-center gap-1.5 text-sm font-medium text-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          {ctaLabel} <ArrowRight className="size-4" />
        </Link>
      )}
    </div>
  );
}
