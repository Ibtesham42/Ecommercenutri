import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AiBannerContent } from "@/lib/validations/admin";

export function HomeAiBanner({ content }: { content: AiBannerContent }) {
  const style: CSSProperties = {};
  if (content.bgColor) style.background = content.bgColor;
  if (content.textColor) style.color = content.textColor;
  const styled = Boolean(content.bgColor || content.textColor);

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-16">
      <div
        className={cn(
          "relative overflow-hidden rounded-3xl px-6 py-12 shadow-elev-2 sm:px-12",
          !styled && "bg-surface-deep text-surface-deep-foreground",
        )}
        style={styled ? style : undefined}
      >
        {/* Warm-gold ambient glow (default surface only). */}
        {!styled && (
          <div className="pointer-events-none absolute -right-10 -top-10 size-56 rounded-full bg-gold/25 blur-3xl" />
        )}
        <div className="relative z-10 max-w-2xl space-y-4">
          {content.eyebrow && (
            <Badge className="gap-1.5 border border-white/20 bg-white/10 text-current hover:bg-white/15">
              <span className="size-1.5 rounded-full bg-gold" />
              <Sparkles className="size-3.5 text-gold" /> {content.eyebrow}
            </Badge>
          )}
          {content.title && (
            <h2 className="font-heading text-3xl font-semibold sm:text-4xl">
              {content.title}
            </h2>
          )}
          {content.description && <p className="opacity-80">{content.description}</p>}
          {content.ctaLabel && (
            <Button
              asChild
              size="lg"
              className="gap-2 bg-gold font-semibold text-gold-foreground hover:bg-gold/90"
            >
              <Link href={content.ctaHref || "#"}>
                {content.ctaLabel} <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>
        <Sparkles className="absolute -right-6 -top-6 size-48 text-gold opacity-10" />
      </div>
    </section>
  );
}
