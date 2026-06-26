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
          "relative overflow-hidden rounded-3xl px-6 py-12 sm:px-12",
          !styled && "bg-primary text-primary-foreground",
        )}
        style={styled ? style : undefined}
      >
        <div className="relative z-10 max-w-2xl space-y-4">
          {content.eyebrow && (
            <Badge className="gap-1.5 bg-white/15 text-current hover:bg-white/20">
              <Sparkles className="size-3.5" /> {content.eyebrow}
            </Badge>
          )}
          {content.title && <h2 className="text-3xl font-bold sm:text-4xl">{content.title}</h2>}
          {content.description && <p className="opacity-80">{content.description}</p>}
          {content.ctaLabel && (
            <Button asChild size="lg" variant="secondary" className="gap-2">
              <Link href={content.ctaHref || "#"}>
                {content.ctaLabel} <ArrowRight className="size-4" />
              </Link>
            </Button>
          )}
        </div>
        <Sparkles className="absolute -right-6 -top-6 size-48 opacity-10" />
      </div>
    </section>
  );
}
