import type { CSSProperties } from "react";
import Link from "next/link";
import { ArrowRight, Sparkles, Leaf } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { HeroContent } from "@/lib/validations/admin";

export function HomeHero({ content }: { content: HeroContent }) {
  const style: CSSProperties = {};
  if (content.bgColor) style.background = content.bgColor;
  if (content.textColor) style.color = content.textColor;
  const styled = Boolean(content.bgColor || content.textColor);

  return (
    <section
      className={cn(
        "relative overflow-hidden border-b",
        !content.bgColor && "bg-gradient-to-b from-accent/40 via-background to-background",
      )}
      style={styled ? style : undefined}
    >
      <div className="mx-auto grid w-full max-w-7xl items-center gap-10 px-4 py-16 md:grid-cols-2 md:py-24">
        <div className="space-y-6">
          {content.eyebrow && (
            <Badge variant="secondary" className="gap-1.5 rounded-full px-3 py-1">
              <Sparkles className="size-3.5" />
              {content.eyebrow}
            </Badge>
          )}
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            {content.title}{" "}
            {content.highlight && (
              <span className={content.textColor ? undefined : "text-primary"}>{content.highlight}</span>
            )}
          </h1>
          {content.description && (
            <p className={cn("max-w-md text-lg", !content.textColor && "text-muted-foreground")}>
              {content.description}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {content.primaryLabel && (
              <Button asChild size="lg" className="gap-2">
                <Link href={content.primaryHref || "#"}>
                  {content.primaryLabel} <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
            {content.secondaryLabel && (
              <Button asChild size="lg" variant="outline" className="gap-2">
                <Link href={content.secondaryHref || "#"}>
                  <Sparkles className="size-4" /> {content.secondaryLabel}
                </Link>
              </Button>
            )}
          </div>
          {content.stats.length > 0 && (
            <div className="flex gap-8 pt-4">
              {content.stats.map((s, i) => (
                <div key={i}>
                  <div className="font-heading text-2xl font-bold">{s.value}</div>
                  <div className={cn("text-xs", !content.textColor && "text-muted-foreground")}>
                    {s.label}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="relative hidden md:block">
          <div className="aspect-square w-full rounded-3xl bg-gradient-to-br from-primary/15 via-accent to-gold/20 p-1.5 shadow-elev-3">
            <div className="grid size-full place-items-center rounded-[calc(var(--radius)*2)] bg-card">
              <div className="flex flex-col items-center gap-4 p-8 text-center">
                <span className="grid size-24 place-items-center rounded-full bg-primary/10 text-primary">
                  <Leaf className="size-12" />
                </span>
                <p className="font-heading text-xl font-bold text-foreground">Nutrition, reimagined</p>
                <p className="max-w-xs text-sm text-muted-foreground">
                  Wholesome foods, lab-tested quality, delivered fresh.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
