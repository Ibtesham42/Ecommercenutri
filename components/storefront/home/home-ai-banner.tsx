import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AiBannerContent } from "@/lib/validations/admin";

/**
 * The AI assistant, presented as a quiet supporting band (hairline rules, a
 * text heading and one outline link) — Nutriyet is a food brand first; AI is a
 * helper, not the headline. Admin colour overrides still apply.
 */
export function HomeAiBanner({ content }: { content: AiBannerContent }) {
  const style: CSSProperties = {};
  if (content.bgColor) style.background = content.bgColor;
  if (content.textColor) style.color = content.textColor;
  const styled = Boolean(content.bgColor || content.textColor);

  return (
    <section data-heat="ai-assistant" style={styled ? style : undefined} className={cn(!styled && "bg-background")}>
      <div className="mx-auto w-full max-w-7xl px-4">
        <div className="flex flex-col gap-6 border-y border-border py-10 md:flex-row md:items-center md:justify-between md:gap-12 md:py-12">
          <div className="max-w-2xl">
            {content.eyebrow && <p className="eyebrow">{content.eyebrow}</p>}
            {content.title && (
              <h2 className="mt-3 font-heading text-subheading font-medium">{content.title}</h2>
            )}
            {content.description && (
              <p className={cn("mt-2 text-[15px] leading-relaxed", !styled && "text-muted-foreground")}>
                {content.description}
              </p>
            )}
          </div>
          {content.ctaLabel && (
            <Link
              href={content.ctaHref || "/assistant"}
              className="inline-flex h-12 shrink-0 items-center gap-2 self-start rounded-md border border-foreground/20 px-6 text-[15px] font-medium transition-colors hover:bg-oat md:self-auto"
            >
              {content.ctaLabel} <ArrowRight className="size-4" />
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
